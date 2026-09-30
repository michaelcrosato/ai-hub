import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TYPES } from './catalog.js';
const C={dark:0x263637,steel:0x506563,cream:0xe3dbc1,glass:0x9bd7d1,gold:0xe8bd61,rubber:0x283330,white:0xf5eed6};
/** Primitive geometry is merged into vertex-coloured meshes, not hundreds of
 * independent draw calls. Geometry is shared between all units of a type. */
class Bricks {
  constructor(){this.parts=[];}
  add(g,color,x=0,y=0,z=0,rx=0,ry=0,rz=0){
    g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);
    const col=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=col.r;colors[i+1]=col.g;colors[i+2]=col.b;}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));this.parts.push(g);return this;
  }
  box(w,h,d,c,x=0,y=0,z=0,ry=0){return this.add(new THREE.BoxGeometry(w,h,d),c,x,y,z,0,ry);}
  cyl(r,h,c,x=0,y=0,z=0,n=8,rx=0){return this.add(new THREE.CylinderGeometry(r,r,h,n),c,x,y,z,rx);}
  cone(r,h,c,x=0,y=0,z=0,n=4){return this.add(new THREE.ConeGeometry(r,h,n),c,x,y,z,0,Math.PI/4);}
  studs(w,d,y,c,x=0,z=0,step=1){for(let a=-w/2+.6;a<w/2;a+=step)for(let b=-d/2+.6;b<d/2;b+=step)this.cyl(.18,.13,c,x+a,y,z+b);return this;}
  finish(){if(!this.parts.length)return new THREE.BoxGeometry(.01,.01,.01);const g=mergeGeometries(this.parts,false);this.parts.forEach(p=>p.dispose());return g;}
}
export class ModelFactory {
  constructor(material){this.material=material;this.cache=new Map();}
  make(type,owner=0,faction='allies') {
    const key=`${type}:${owner}:${faction}`;let entry=this.cache.get(key);
    if(!entry){entry=this.build(type,owner,faction);this.cache.set(key,entry);}
    const group=new THREE.Group();
    const body=new THREE.Mesh(entry.body,this.material);body.castShadow=true;body.receiveShadow=true;group.add(body);
    if(entry.turret){const pivot=new THREE.Group();pivot.position.y=entry.turretHeight||0;const t=new THREE.Mesh(entry.turret,this.material);t.castShadow=true;t.receiveShadow=true;pivot.add(t);group.add(pivot);group.userData.turret=pivot;}
    if(entry.rotor){const rotor=new THREE.Mesh(entry.rotor,this.material);rotor.position.y=entry.rotorHeight;rotor.castShadow=true;group.add(rotor);group.userData.rotor=rotor;}
    return group;
  }
  build(type,owner,faction) {
    const side=owner===0?faction:(faction==='allies'?'soviet':'allies');
    const team=owner===2?0xd3b665:side==='allies'?0x61bfb8:0xd4654d;
    const light=new THREE.Color(team).lerp(new THREE.Color(C.cream),.25).getHex();
    const b=new Bricks(),t=new Bricks();const d=TYPES[type];let turret=false,turretHeight=0,rotor=null,rotorHeight=0;
    if(d.kind==='unit') {
      if(d.category==='infantry') {
        b.box(.24,.55,.3,C.dark,-.17,.3).box(.24,.55,.3,C.dark,.17,.3);
        b.box(.65,.62,.4,team,0,.85).box(.21,.58,.28,team,-.43,.83).box(.21,.58,.28,team,.43,.83);
        b.box(.4,.36,.37,C.cream,0,1.36).cyl(.32,.2,type==='engineer'?C.gold:type==='medic'?C.white:type==='commando'?C.dark:team,0,1.59);
        b.box(.32,.11,.1,C.dark,0,1.36,.2);
        if(type==='rocket')b.box(.24,.24,.94,C.dark,.42,1.03,.22).cyl(.15,.14,C.gold,.42,1.03,.72,8,Math.PI/2);
        else if(type==='engineer')b.box(.5,.35,.38,C.gold,.51,.55,.2);
        else if(type==='medic'){b.box(.28,.1,.02,C.white,0,.87,.23).box(.1,.3,.03,C.white,0,.87,.24);}
        else if(type==='commando'){b.box(.14,.14,1.05,C.dark,.35,.92,.45).box(.46,.5,.22,C.steel,0,.92,-.31).box(.5,.08,.42,C.gold,0,1.08,0);}
        else b.box(.16,.15,.72,C.dark,.35,.9,.36);
        b.cyl(.16,.12,light,0,1.74);return {body:b.finish()};
      }
      if(d.domain==='air') {
        b.box(1.15,.7,2.2,team,0,.15).box(.85,.5,.9,C.glass,0,.33,.85);
        b.box(.35,.35,2.25,team,0,.16,-1.8).box(1.2,.12,.45,team,0,.38,-2.7);
        b.box(.12,.18,2.6,C.dark,-.85,-.48).box(.12,.18,2.6,C.dark,.85,-.48);
        b.box(.1,.7,.12,C.steel,-.75,-.15,.6).box(.1,.7,.12,C.steel,.75,-.15,.6);
        b.box(2.4,.16,.55,team,0,.03,-.4).box(.26,.26,.95,C.dark,-1.03,-.2,.0).box(.26,.26,.95,C.dark,1.03,-.2,.0);
        const r=new Bricks();r.box(.17,.08,6.2,C.dark).box(6.2,.08,.17,C.dark).cyl(.23,.25,C.steel,0,.08);rotor=r.finish();rotorHeight=.87;
      } else if(d.domain==='naval') {
        if(type==='submarine') {
          b.box(1.3,.45,4.1,C.dark,0,.08).box(.95,.28,4.65,team,0,.26).box(.48,.65,.8,team,0,.63,-.4);
          b.box(.09,.45,.09,C.steel,0,1.1,-.2).box(2.25,.1,.5,C.dark,0,.17,-1.8);
        } else {
          b.box(2.1,.55,5,C.dark,0,.1).box(1.7,.3,5.35,team,0,.46).box(1.9,.16,4.6,C.cream,0,.67);
          b.box(1.1,.85,1.6,team,0,1.1,-.3).box(.9,.3,.55,C.glass,0,1.65,-.15).box(.14,1.5,.14,C.steel,0,2,-.7);
          b.box(.9,.08,.1,C.steel,0,2.6,-.7).cyl(.25,.75,C.dark,.55,1.38,-1.5);
          t.box(.85,.35,.8,light,0,.12).box(.13,.13,1.65,C.steel,-.2,.35,.77).box(.13,.13,1.65,C.steel,.2,.35,.77);
          turret=true;turretHeight=.87;
          b.box(.8,.3,.8,light,0,.88,-1.8).box(.12,.12,1.25,C.steel,0,1.06,-2.5);
          b.studs(1.4,1,.8,light,0,1.6);
        }
      } else {
        const big=type==='mcv'||type==='harvester',heavy=type==='heavy'||type==='mammoth';
        const w=big?2.35:heavy?2.25:1.85,len=big?3.3:2.7;
        b.box(w,.55,len,C.dark,0,.38).box(w-.4,.55,len-.25,team,0,.81);
        for(const side of [-1,1]) {
          b.box(.4,.7,len+.15,C.rubber,side*w/2,.4);
          for(let i=0;i<5;i++)b.cyl(.25,.13,C.steel,side*(w/2+.22),.42,-len*.39+i*len*.19,8,Math.PI/2);
          b.box(.45,.17,len+.2,team,side*w/2,.89);
        }
        b.box(.22,.12,.08,C.white,-.61,.91,len/2+.03).box(.22,.12,.08,C.white,.61,.91,len/2+.03);
        b.studs(w-.7,1,1.15,light,0,-.7);
        if(big){
          b.box(w-.6,1.0,1.0,team,0,1.35,1).box(w-.8,.35,.06,C.glass,0,1.55,1.53);
          if(type==='harvester'){
            b.box(1.55,.7,1.9,C.gold,0,1.35,-.6);b.studs(1.4,1.7,1.77,0xf5ca6b,0,-.6,.65);
            b.box(1.8,.4,.4,C.dark,0,.67,1.9);
          }else{
            b.box(1.7,.55,1.65,C.cream,0,1.45,-.6).box(.3,1.35,.3,C.gold,.48,2.1,-.55).box(1.7,.22,.22,C.gold,-.2,2.72,-.55);
          }
        }else if(type==='teslaTank'){
          // A squat turret carrying a coil: the mobile cousin of the Tesla coil defense.
          t.box(1.3,.42,1.3,light,0,.08).cyl(.2,1.25,C.steel,0,.9);
          for(const y of [.55,.9,1.25])t.cyl(.5,.12,team,0,y);
          t.cyl(.27,.28,C.glass,0,1.62);turret=true;turretHeight=1.3;
        }else if(type==='ranger'){
          b.box(1.2,.65,1,team,0,1.25,-.3).box(1.15,.35,.08,C.glass,0,1.37,.25);
          b.box(.65,.08,.65,C.dark,0,1.63,-.3);t.box(.15,.15,1.05,C.dark,0,.2,.3);turret=true;turretHeight=1.65;
        }else{
          t.box(heavy?1.55:1.25,.47,1.35,light,0,.08).cyl(.35,.19,team,.2,.39,-.18);
          t.cyl(.2,.12,light,.2,.53,-.18);
          const barrel=type==='artillery'?2.6:1.65;
          if(heavy){t.box(.18,.18,barrel,C.steel,-.3,.15,1.05).box(.18,.18,barrel,C.steel,.3,.15,1.05);}
          else t.box(.2,.2,barrel,C.steel,0,.16,barrel/2+.3);
          t.box(.35,.12,.48,team,-.43,.35,-.25);turret=true;turretHeight=1.3;
        }
      }
    } else {
      const [w,h]=d.size;
      b.box(w+.65,.23,h+.65,C.steel,0,.1).box(w,.5,h,team,0,.46);
      b.box(w+.12,.13,.2,C.cream,0,.74,h/2).box(w+.12,.13,.2,C.cream,0,.74,-h/2);
      if(type==='conyard') {
        b.box(3.9,1.7,4.3,C.cream,-.65,1.6).box(4.2,.3,4.5,team,-.65,2.62);b.studs(3.8,4.1,2.85,light,-.65);
        b.box(1.6,1.6,.1,C.dark,-.7,1.52,2.22).box(1.7,.2,.2,C.gold,-.7,2.35,2.3);
        b.box(.65,5.5,.65,C.gold,2.2,2.8,-1.7).box(5.3,.5,.6,C.gold,.2,5.57,-1.7);
        b.box(.55,.8,.8,C.dark,-2.15,5.1,-1.7).box(.08,2.25,.08,C.steel,-2.15,3.6,-1.7);
        b.box(.65,.18,.45,C.dark,-2.15,2.42,-1.7);
      } else if(type==='power'||type==='advancedPower') {
        b.box(w-1,1.3,h-1,C.cream,0,1.3).box(w-.6,.25,h-.6,team,0,2.08);
        for(const x of type==='advancedPower'?[-1.4,0,1.4]:[-.85,.85]){
          b.cyl(.54,2.1,C.cream,x,2.1).cyl(.69,.25,team,x,3.05).cyl(.55,.16,C.dark,x,3.21);b.cyl(.27,.12,0xc7e9af,x,3.31);
        }
        b.box(1.4,.35,.12,C.gold,0,1.36,h/2-.43);
      } else if(type==='refinery') {
        b.box(2.6,1.8,3.6,C.cream,-1.2,1.45).box(2.9,.3,3.9,team,-1.2,2.5);b.studs(2.5,3.5,2.72,light,-1.2);
        b.cyl(1,2.65,C.steel,1.35,1.8,-1).cyl(1.12,.3,team,1.35,3.2,-1);
        b.cyl(.4,4.1,team,-2.1,2.35,-2.1).cyl(.52,.24,C.dark,-2.1,4.4,-2.1);
        b.box(2.8,.25,2.4,C.gold,.8,.86,1.9).box(1.8,.06,1.65,C.dark,.8,1.02,1.9);
        for(let i=0;i<3;i++)b.box(.12,.04,1.6,C.gold,.2+i*.6,1.07,1.9);
      } else if(type==='factory') {
        b.box(w-.7,2.3,h-1,C.cream,0,1.73,-.3).box(w-.3,.35,h-.5,team,0,3.05,-.3);
        b.box(3.6,1.9,.12,C.dark,0,1.7,h/2-.78).box(3.9,.24,.3,C.gold,0,2.64,h/2-.65);
        b.box(3.65,.08,1.7,C.steel,0,.82,h/2+.12);b.studs(w-1,h-1,3.32,light,0,-.3);
        b.box(1.0,.45,1.0,C.dark,-2,3.4,-1.5);
      } else if(type==='barracks') {
        b.box(w-.6,1.4,h-.65,C.cream,0,1.25).box(w-.3,.35,h-.3,team,0,2.1);b.studs(w-.8,h-.8,2.38,light);
        b.box(.95,1.4,.08,C.dark,0,1.3,h/2-.27).box(.12,3.3,.12,C.steel,2.1,2.1,-1.7).box(.9,.6,.04,team,2.58,3.5,-1.7);
        for(const x of [-1.5,1.5])b.box(.7,.38,.08,C.glass,x,1.6,h/2-.28);
      } else if(type==='radar'||type==='relay') {
        b.box(w-.8,1.5,h-.8,C.cream,0,1.3).box(w-.5,.25,h-.5,team,0,2.2);b.cyl(.3,1.3,C.steel,0,2.95);
        t.add(new THREE.SphereGeometry(1.65,12,6,0,Math.PI*2,0,Math.PI*.47),C.cream,0,.35,0,Math.PI*.5);
        t.box(.12,.12,1.6,team,0,.6,.4);turret=true;turretHeight=3.35;
      } else if(type==='tower') {
        // Broadcast tower: a braced lattice mast with a beacon and a turning dish.
        b.box(w-1,1,h-1,C.cream,0,1.05).box(w-.7,.2,h-.7,team,0,1.62);
        for(const sx of [-1,1])for(const sz of [-1,1])b.box(.2,6.4,.2,C.gold,sx*.95,4.9,sz*.95);
        for(let y=2.6;y<8;y+=1.35)b.box(2.1,.12,.12,C.gold,0,y,.95).box(2.1,.12,.12,C.gold,0,y,-.95).box(.12,.12,2.1,C.gold,.95,y).box(.12,.12,2.1,C.gold,-.95,y);
        b.box(1.4,.5,1.4,team,0,8.3).cyl(.32,.5,C.glass,0,8.8).cyl(.4,.1,C.dark,0,9.1);
        t.add(new THREE.SphereGeometry(.75,10,5,0,Math.PI*2,0,Math.PI*.45),C.cream,0,.3,0,Math.PI*.5).box(.1,.1,.8,team,0,.35,.3).box(.12,.5,.12,C.steel,0,-.05,0);
        turret=true;turretHeight=9.3;
      } else if(type==='oil') {
        b.box(2.5,1.3,2.5,C.steel,0,1.1);
        b.box(.25,3.4,.3,C.gold,-.9,2.5).box(.25,3.4,.3,C.gold,.9,2.5);
        b.box(2.8,.3,.5,team,.5,3.95).box(.2,2.5,.2,C.dark,1.65,2.7);
        b.cyl(.58,.4,team,0,2.3,0,8,Math.PI/2);
      } else if(type==='tesla') {
        b.box(1.7,1.1,1.7,C.cream,0,1.2).cyl(.31,3.1,C.steel,0,2.8);
        for(let y=1.8;y<4.4;y+=.65)b.cyl(.85,.18,team,0,y);b.cyl(.39,.34,C.glass,0,4.5);
      } else if(type==='sam') {
        b.box(1.8,.7,1.8,C.steel,0,1.05);t.box(1.9,.75,1.1,team,0,.3);
        for(const x of [-.65,0,.65])t.box(.36,.32,1.85,C.dark,x,.45,.2).box(.36,.32,.12,C.cream,x,.45,1.15);
        turret=true;turretHeight=1.45;
      } else if(type==='pillbox') {
        b.box(2.5,1.2,2.5,C.cream,0,1.23).box(2.8,.4,2.8,team,0,2);
        b.box(1.4,.25,.05,C.dark,0,1.55,1.27).box(.1,.14,1,C.dark,0,1.55,1.5);b.studs(2.3,2.3,2.3,light);
      } else if(type==='helipad'||type==='repair') {
        b.box(w-.5,.12,h-.5,C.dark,0,.83);
        b.box(.2,.04,3,C.cream,-1,.92).box(.2,.04,3,C.cream,1,.92).box(2.2,.04,.2,C.cream,0,.92);
        if(type==='repair')for(const x of [-2.2,2.2])b.box(.4,1.4,3.6,team,x,1.45);
        else for(const x of [-2.5,2.5])for(const z of [-2.5,2.5])b.cyl(.15,.14,C.gold,x,.98,z);
      } else if(type==='shipyard') {
        b.box(1.1,.4,7,C.cream,-2.5,.8).box(1.1,.4,7,C.cream,2.5,.8);
        b.box(4.2,1.9,2.5,C.cream,0,1.65,-1.5).box(4.6,.35,2.9,team,0,2.74,-1.5);
        b.box(.25,4.5,.25,C.gold,-2,3,1).box(4.8,.3,.3,C.gold,0,5.2,1);
        b.box(.1,2.5,.1,C.steel,1.8,4,1);
      } else if(type==='silo') {
        b.cyl(1.8,.4,C.cream,0,.85).cyl(1.4,.12,C.dark,0,1.1);
        b.cyl(.58,2.5,C.cream,0,1.5).cone(.6,1.0,team,0,3.23,0,8);
        for(const x of [-1.9,1.9])b.box(.6,1.2,2,team,x,1.3);
      } else {
        b.box(w-.6,2.1,h-.6,C.cream,0,1.65).box(w-.2,.3,h-.2,team,0,2.86);
        for(let x=-w/2+.9;x<w/2;x+=1.1)b.box(.7,.6,.04,C.glass,x,1.9,h/2-.28);
        b.studs(w-.8,h-.8,3.1,light);b.cyl(.5,1.1,C.steel,1,3.5,-1);
      }
    }
    return {body:b.finish(),turret:turret?t.finish():null,turretHeight,rotor,rotorHeight};
  }
}
export { Bricks };
