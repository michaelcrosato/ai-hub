import * as THREE from 'three/webgpu';
import { createPoints } from 'kit/points.js';
import { random } from '../core/math.js';
const TAU=Math.PI*2;
/** All models and textures are generated here. No film images, audio, or model files. */
export class SceneArt {
  constructor(game,scope){
    this.game=game;this.scope=scope;this.group=new THREE.Group();this.group.name='Cyberdyne scene art';game.view.scene.add(this.group);
    this.geometries=new Map();this.materials=new Map();this.textures=new Set();this.instances=[];this.time=0;this.serial=0;
    this.geometries.set('box',new THREE.BoxGeometry(1,1,1));
    this.geometries.set('cylinder',new THREE.CylinderGeometry(1,1,1,16));
    this.geometries.set('sphere',new THREE.SphereGeometry(1,16,12));
    this.geometries.set('plane',new THREE.PlaneGeometry(1,1));
    this.geometries.set('cone',new THREE.ConeGeometry(1,1,12));
    this.geometries.set('ring',new THREE.TorusGeometry(1,.13,6,24));
    this.glowTexture=this.radial();
    this.buildWorld();
    this.gun=this.minigun(true);this.gun.position.set(.32,-.32,-.51);game.view.camera.add(this.gun);game.view.scene.add(game.view.camera);
    this.gunFill=new THREE.PointLight('#b8dbff',.9,3,1);this.gunFill.position.set(-.25,.15,-.3);game.view.camera.add(this.gunFill);
    this.flashLight=new THREE.PointLight('#ffb35b',0,11,1.2);this.flashLight.position.set(.15,-.08,-1);game.view.camera.add(this.flashLight);
    this.hero=this.person(true);this.hero.position.set(2,6.2,-4.5);this.hero.rotation.y=Math.PI+.2;this.hero.visible=false;this.group.add(this.hero);
    const heroGun=this.minigun(false);heroGun.scale.setScalar(.7);heroGun.rotation.y=Math.PI;heroGun.position.set(-.2,.86,.62);this.hero.add(heroGun);
    this.scope.own(()=>this.dispose());
  }
  /** A unique key for materials that are not shared (their opacity animates on its own). */
  key(prefix){return `${prefix}-${++this.serial}`;}
  mat(color,metal=0,rough=.65,emissive=0){
    const key=[color,metal,rough,emissive].join('/');
    if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive:color,emissiveIntensity:emissive}));
    return this.materials.get(key);
  }
  basic(color,opacity=1){const key=`basic/${color}/${opacity}`;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1}));return this.materials.get(key);}
  mesh(parent,shape,pos,scale,material,rotation){
    const mesh=new THREE.Mesh(this.geometries.get(shape),material);mesh.position.set(...pos);mesh.scale.set(...scale);if(rotation)mesh.rotation.set(...rotation);
    mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  box(parent,pos,size,color,metal=0,rough=.65,rotation){return this.mesh(parent,'box',pos,size,this.mat(color,metal,rough),rotation);}
  radial(){
    const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.12,'rgba(255,255,255,.8)');g.addColorStop(.38,'rgba(255,255,255,.16)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
    const tex=new THREE.CanvasTexture(c);this.textures.add(tex);return tex;
  }
  glow(parent,pos,color,size,opacity=.6){
    const m=new THREE.SpriteMaterial({map:this.glowTexture,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
    this.materials.set(this.key('sprite'),m);const s=new THREE.Sprite(m);s.position.set(...pos);s.scale.set(size,size,1);parent.add(s);return s;
  }
  pool(parent,pos,color,w,h,opacity=.2){
    const m=new THREE.MeshBasicMaterial({map:this.glowTexture,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});this.materials.set(this.key('pool'),m);
    return this.mesh(parent,'plane',pos,[w,h,1],m,[-Math.PI/2,0,0]);
  }
  /** Forget and dispose a material made by glow() or pool(). */
  release(material){
    for(const [key,m] of this.materials)if(m===material){this.materials.delete(key);break;}
    material.dispose();
  }
  label(parent,text,pos,width,height,color='#b6d8df',bg=null,rotation=[0,0,0]){
    const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');
    if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);}ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 78px Arial';ctx.fillText(text,512,68,990);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;this.textures.add(tex);
    const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide});this.materials.set(this.key('label'),m);
    return this.mesh(parent,'plane',pos,[width,height,1],m,rotation);
  }
  batchBoxes(parent,items,material){
    if(!items.length)return;
    const mesh=new THREE.InstancedMesh(this.geometries.get('box'),material,items.length),dummy=new THREE.Object3D();
    items.forEach((a,i)=>{dummy.position.set(...a[0]);dummy.scale.set(...a[1]);dummy.rotation.set(0,a[2]??0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.receiveShadow=true;parent.add(mesh);this.instances.push(mesh);return mesh;
  }
  buildWorld(){
    const g=this.group,view=this.game.view,rng=random(1991);
    view.hemi.color.set('#88b7e8');view.hemi.groundColor.set('#101921');view.hemi.intensity=.8;
    view.sun.color.set('#9fcaff');view.sun.position.set(-15,28,-12);view.sun.intensity=.95;
    view.sun.shadow.camera.left=-45;view.sun.shadow.camera.right=45;view.sun.shadow.camera.top=35;view.sun.shadow.camera.bottom=-40;view.sun.shadow.camera.updateProjectionMatrix();
    // Grain in the pavement is a small deterministic canvas texture.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#1c2730';ctx.fillRect(0,0,256,256);
    for(let i=0;i<18000;i++){const c=20+Math.floor(rng()*45);ctx.fillStyle=`rgba(${c},${c+6},${c+10},.55)`;ctx.fillRect(rng()*256,rng()*256,1+ rng(),1);}
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(22,16);tex.anisotropy=4;this.textures.add(tex);
    const road=new THREE.MeshStandardMaterial({map:tex,color:'#c4d8e6',roughness:.38,metalness:.12});this.materials.set('road',road);
    this.mesh(g,'plane',[0,.008,-27],[100,85,1],road,[-Math.PI/2,0,0]);
    const lines=[];
    for(let x=-46;x<48;x+=7){lines.push([[x,.025,-26.5],[3.8,.018,.13]],[[x,.025,-27.1],[3.8,.018,.13]]);}
    for(let x=-44;x<48;x+=6){lines.push([[x,.03,-40],[.1,.02,7]],[[x,.03,-47],[5.8,.02,.1]]);}
    this.batchBoxes(g,lines,this.mat('#acac8b',0,.85));
    this.box(g,[0,.15,-51],[100,.3,4],'#5b6b74');
    this.box(g,[-29,.15,-17],[10,.3,18],'#344a4d');this.box(g,[29,.15,-17],[10,.3,18],'#344a4d');
    // Office block across the street, with repeated lit windows.
    this.box(g,[0,11,-59],[66,22,10],'#162b3b',.25,.4);
    const mullions=[],lit=[],dim=[];
    for(let x=-31;x<33;x+=2.6)for(let y=2.6;y<22;y+=3.1){
      (rng()>.59?lit:dim).push([[x,y,-53.95],[2.15,2.35,.04]]);
    }
    this.batchBoxes(g,lit,this.mat('#7397a7',.1,.35,.18));this.batchBoxes(g,dim,this.mat('#1a3b50',.35,.25,.04));
    for(let y=0;y<23;y+=3.1)mullions.push([[0,y,-53.8],[66,.13,.24]]);
    for(let x=-33;x<34;x+=2.6)mullions.push([[x,11,-53.8],[.1,22,.25]]);
    this.batchBoxes(g,mullions,this.mat('#425564',.65,.45));
    this.label(g,'CYBERDYNE SYSTEMS',[0,18.2,-53.55],24,1.2,'#c1e5ea');
    this.label(g,'RESEARCH & DEVELOPMENT',[0,16.8,-53.54],13,.5,'#7496a6');
    const city=[],cityLights=[];
    for(let i=0;i<26;i++){
      const x=-100+i*8+rng()*6,z=-83-rng()*25,h=14+rng()*43,w=4+rng()*7;
      city.push([[x,h/2,z],[w,h,7]]);
      for(let y=3;y<h-2;y+=3.5)for(let j=-1;j<2;j++)if(rng()>.35)cityLights.push([[x+j*1.6,y,z+3.51],[.5,.85,.03]]);
    }
    this.batchBoxes(g,city,this.mat('#122331',0,.9));this.batchBoxes(g,cityLights,this.mat('#778c9d',0,.5,.35));
    // Tall side wings keep the street in a clear frame.
    for(const side of [-1,1]){
      this.box(g,[side*46,13,-22],[12,26,41],'#1c3548',.2,.45);
      const windows=[];for(let z=-38;z<-5;z+=3)for(let y=3;y<26;y+=3)windows.push([[side*39.94,y,z],[.05,2.1,2.25]]);
      this.batchBoxes(g,windows,this.mat('#37617a',.25,.4,.12));
    }
    // Balcony tiles, glass frames, ceiling strips, and lab monitors.
    const tileLines=[];
    for(let x=-19;x<20;x+=2)tileLines.push([[x,6.207,4.8],[.015,.012,21]]);
    for(let z=-5;z<16;z+=2)tileLines.push([[0,6.21,z],[39.5,.013,.015]]);
    this.batchBoxes(g,tileLines,this.mat('#304957',0,.8));
    for(const side of [-1,1])for(let i=0;i<5;i++){
      this.box(g,[side*(6.5+i*2.6),8,3.46],[.07,3.55,.2],'#74939f',.55,.3);
      this.box(g,[side*(6.5+i*2.6),8.9,9.45],[1.4,.8,.15],'#102532');
      this.mesh(g,'box',[side*(6.5+i*2.6),8.9,9.35],[1.25,.64,.02],this.mat('#3d929a',0,.6,.65));
    }
    for(let x=-16;x<=16;x+=8){this.mesh(g,'box',[x,10.13,9],[5,.035,.27],this.mat('#c0dbe8',0,.5,2));this.pool(g,[x,6.225,9],'#5f95b8',7,8,.16);}
    this.label(g,'CYBERDYNE',[0,9.1,15.41],11,.85,'#b5d1d7',null,[0,Math.PI,0]);
    this.label(g,'SYSTEMS',[0,8.5,15.39],5,.36,'#6c9da9',null,[0,Math.PI,0]);
    this.label(g,'SUPPORT',[0,8.35,14.68],2.15,.35,'#82ffc4',null,[0,Math.PI,0]);
    this.exitGlow=this.glow(g,[0,7.85,14.62],'#57ecb3',1.4,.55);
    // Potted plants on the terrace.
    for(const x of [-17,17]){
      this.box(g,[x,6.55,1],[1.1,.7,1.1],'#263d49');
      for(let k=0;k<7;k++){const m=this.mesh(g,'sphere',[x+(rng()-.5)*.7,7.25+rng()*.4,1+(rng()-.5)*.7],[.22,.6,.2],this.mat('#203e3a'));m.rotation.z=(rng()-.5);}
    }
    // Light poles and soft pools. Only two sources need a real point light.
    for(const [i,[x,z]] of [[-32,-42],[32,-42],[-29,-10],[29,-10]].entries()){
      this.mesh(g,'cylinder',[x,5.8,z],[.12,11.6,.12],this.mat('#304452',.7,.3));
      this.box(g,[x-1,11.5,z],[2.3,.16,.14],'#334a59',.6,.4);
      this.mesh(g,'box',[x-2,11.4,z],[.75,.06,.36],this.mat('#ffe0a1',0,.5,3));
      this.glow(g,[x-2,11.35,z],'#ffcb80',2,.6);this.pool(g,[x-2,.05,z],'#e3b37c',18,18,.23);
      if(i<2){const light=new THREE.PointLight('#efc69a',95,26,2);light.position.set(x-2,10,z);g.add(light);}
    }
    // Moon and fine stars. The stars are one-pixel sprites (kit/points.js), drawn first and opaque.
    this.mesh(g,'sphere',[-44,57,-105],[2.2,2.2,2.2],this.basic('#b8cad8'));
    this.glow(g,[-44,57,-105],'#699bd2',18,.3);
    const stars=new Float32Array(450*3);for(let i=0;i<450;i++){stars[i*3]=(rng()-.5)*380;stars[i*3+1]=28+rng()*105;stars[i*3+2]=-110-rng()*100;}
    this.stars=createPoints({positions:stars,size:1,sizeAttenuation:false,material:{color:new THREE.Color('#a9c4df').multiplyScalar(.55),transparent:false,depthWrite:false}});
    this.stars.object.renderOrder=-1;this.materials.set('stars',this.stars.material);g.add(this.stars.object);
    this.buildHelicopter();
    // A cool wall wash makes the player model readable from the menu camera.
    const fill=new THREE.PointLight('#9bcfff',36,18,2);fill.position.set(1,9,0);g.add(fill);
  }
  person(hero=false){
    const g=new THREE.Group(),skin=hero?'#aa8d78':'#a39c86',cloth=hero?'#151c22':'#182938';
    this.box(g,[0,1.22,0],[hero?.7:.52,.67,.33],cloth,.25,.48);
    this.box(g,[0,.91,0],[hero?.53:.46,.27,.29],'#151e26',.15,.7);
    this.box(g,[0,1.02,.181],[.11,.065,.025],'#acac98',.8,.25);
    const legs=[];for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.155,.88,0);g.add(leg);this.box(leg,[0,-.35,0],[.23,.72,.27],'#18212a',.12,.7);
      this.box(leg,[0,-.79,.045],[.24,.19,.39],'#10171b',.3,.45);legs.push(leg);
      const arm=new THREE.Group();arm.position.set(side*(hero?.44:.34),1.48,0);arm.rotation.x=-.42;arm.rotation.z=side*.08;g.add(arm);
      this.mesh(arm,'cylinder',[0,-.21,0],[hero?.16:.12,.44,hero?.16:.12],this.mat(cloth,.23,.5));
      this.mesh(arm,'cylinder',[0,-.44,.16],[.105,.4,.105],this.mat(cloth,.2,.5),[1.1,0,0]);
      this.mesh(arm,'sphere',[0,-.47,.34],[.1,.105,.11],this.mat(skin,0,.9));
    }
    this.mesh(g,'cylinder',[0,1.6,0],[.12,.2,.12],this.mat(skin));
    this.box(g,[0,1.82,.015],[hero?.36:.3,hero?.43:.37,.32],skin);
    this.box(g,[0,1.93,-.045],[.37,.21,.32],hero?'#292724':'#162630');
    if(hero){
      this.box(g,[0,1.87,.185],[.36,.095,.04],'#07121c',.75,.14);
      this.box(g,[0,1.785,.202],[.08,.12,.055],skin);this.box(g,[0,1.67,.1],[.28,.08,.22],skin);
      this.box(g,[-.12,1.43,.181],[.22,.34,.055],'#303438',.4,.42,[0,0,-.36]);this.box(g,[.12,1.43,.181],[.22,.34,.055],'#303438',.4,.42,[0,0,.36]);
      this.box(g,[.07,1.2,.18],[.018,.46,.025],'#a7b3bb',.8,.25);
      this.glow(g,[.094,1.87,.213],'#ff361c',.055,.6);
    }else{
      this.box(g,[0,2.005,.085],[.36,.09,.43],'#172c3b');this.box(g,[-.14,1.34,.185],[.085,.105,.024],'#b6a36d',.6,.4);
      this.box(g,[.19,1.05,.34],[.09,.13,.36],'#0b1720',.5,.4);
    }
    g.userData.legs=legs;return g;
  }
  minigun(withArms){
    const g=new THREE.Group(),rotor=new THREE.Group();g.add(rotor);rotor.position.set(0,0,-.61);g.userData.rotor=rotor;
    const steel=this.mat('#45545c',.78,.29),dark=this.mat('#17262f',.65,.36),edge=this.mat('#a5b5bb',.8,.28),black=this.mat('#111b22',.2,.65);
    this.mesh(g,'cylinder',[0,0,-.17],[.19,.55,.19],dark,[Math.PI/2,0,0]);
    this.mesh(g,'cylinder',[0,0,.1],[.225,.14,.225],steel,[Math.PI/2,0,0]);
    this.mesh(g,'cylinder',[0,0,-.43],[.215,.095,.215],edge,[Math.PI/2,0,0]);
    this.mesh(g,'box',[.12,-.06,.02],[.16,.22,.42],dark);
    this.mesh(g,'cylinder',[-.19,-.08,.04],[.16,.32,.16],dark,[0,0,Math.PI/2]);
    this.mesh(g,'box',[.03,.2,-.03],[.075,.18,.075],black);
    this.mesh(g,'box',[.03,.295,.045],[.075,.06,.26],steel);
    for(let i=0;i<6;i++){
      const a=i*TAU/6,x=Math.cos(a)*.115,y=Math.sin(a)*.115;
      this.mesh(rotor,'cylinder',[x,y,-.33],[.04,.87,.04],steel,[Math.PI/2,0,0]);
      this.mesh(rotor,'cylinder',[x,y,-.78],[.046,.028,.046],edge,[Math.PI/2,0,0]);
      this.mesh(rotor,'cylinder',[x,y,-.798],[.029,.011,.029],black,[Math.PI/2,0,0]);
    }
    for(const z of [-.05,-.57])this.mesh(rotor,'cylinder',[0,0,z],[.178,.06,.178],dark,[Math.PI/2,0,0]);
    const ammo=this.mat('#b3985c',.6,.4);for(let i=0;i<14;i++){
      const angle=i/13*1.25;this.mesh(g,'cylinder',[.18+Math.sin(angle)*.22,-.1-i*.026,.08+Math.cos(angle)*.06],[.015,.13,.015],ammo,[Math.PI/2,0,.12]);
    }
    const flash=new THREE.Group();flash.position.set(0,0,-1.45);g.add(flash);g.userData.flash=flash;
    this.glow(flash,[0,0,0],'#ffb949',.7,.9);this.glow(flash,[0,0,-.06],'#ffe3a1',.3,.95);
    const flame=this.mesh(flash,'cone',[0,0,-.15],[.16,.48,.14],this.basic('#ffd296'),[-Math.PI/2,0,0]);g.userData.flame=flame;flash.visible=false;
    if(withArms){
      const sleeve=this.mat('#162029',.18,.65),skin=this.mat('#a48f7a',0,.8);
      this.mesh(g,'cylinder',[.19,-.18,.39],[.108,.61,.125],sleeve,[1.09,0,-.34]);
      this.mesh(g,'sphere',[.045,.245,.13],[.094,.074,.12],skin);
      this.mesh(g,'cylinder',[-.4,-.22,.1],[.115,.63,.135],sleeve,[.98,0,.56]);
      this.mesh(g,'sphere',[-.18,-.11,-.26],[.092,.078,.12],skin);
      this.mesh(g,'box',[.05,.26,.075],[.085,.075,.13],this.mat('#252a2d',.2,.75));
    }
    return g;
  }
  /** Air One. Its motion, searchlight aim, and lamp damage live in air-unit.js. */
  buildHelicopter(){
    const g=new THREE.Group();this.group.add(g);this.heli=g;
    this.mesh(g,'sphere',[0,0,0],[1.25,1,2.5],this.mat('#203845',.6,.35));
    this.mesh(g,'sphere',[0,.15,-1.5],[1.08,.75,1.12],this.mat('#30596d',.55,.2));
    this.mesh(g,'cylinder',[0,.2,3.2],[.16,4,.2],this.mat('#243c4a',.6,.5),[Math.PI/2,0,0]);
    this.box(g,[0,1.08,5.1],[.15,1.6,.95],'#27404e');
    for(const s of [-1,1]){this.box(g,[s*1,-1.25,0],[.075,.08,3.9],'#566f7e',.7);this.box(g,[s*.8,-.85,.5],[.06,.9,.07],'#536c7a',.6);}
    this.rotor=new THREE.Group();this.rotor.position.y=1.25;g.add(this.rotor);
    this.box(this.rotor,[0,0,0],[10,.045,.19],'#314550',.5);this.box(this.rotor,[0,.015,0],[.19,.045,10],'#314550',.5);
    this.glow(g,[-1.3,.2,0],'#ff4a37',.6,.8);this.glow(g,[1.3,.2,0],'#64c6b3',.5,.7);
    // The searchlight: a lamp under the nose and a translucent cone that hangs from a pivot there.
    this.heliLamp=this.mesh(g,'cylinder',[0,-.98,-1.75],[.3,.26,.3],this.mat('#fff4d8',0,.3,2.5));
    this.heliLampGlow=this.glow(g,[0,-1.12,-1.75],'#dff1ff',1.5,.5);
    const beamM=new THREE.MeshBasicMaterial({color:'#a6cfe9',transparent:true,opacity:.035,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});this.materials.set('heli-beam',beamM);
    this.beamPivot=new THREE.Group();this.beamPivot.position.set(0,-1.1,-1.75);this.beamPivot.rotation.z=.25;g.add(this.beamPivot);
    this.beam=this.mesh(this.beamPivot,'cone',[0,-11,0],[5.5,22,5.5],beamM);
    this.searchPool=this.pool(this.group,[0,.05,-30],'#83bfe4',13,13,.23);g.position.set(-18,26,-40);
  }
  render(dt,{spin=0,firing=false,kick=0}={}){
    this.time+=dt;const t=this.time;
    this.rotor.rotation.y+=dt*48;
    this.gun.userData.rotor.rotation.z-=dt*(spin*65);this.gun.userData.flash.visible=firing;
    if(firing){this.gun.userData.flash.rotation.z=t*61;this.gun.userData.flash.scale.setScalar(.65+Math.random()*.5);}
    this.flashLight.intensity=firing?8:0;
    const move=Math.min(1,Math.hypot(this.game.player.motor.vx,this.game.player.motor.vz)/4);
    this.gun.position.set(.32+Math.sin(t*5)*.004,-.32+Math.sin(t*7)*.009*move,-.51+kick*.5);
    this.gun.rotation.set(kick*.1,0,Math.sin(t*6)*.008*move);
    this.exitGlow.material.opacity=.5+Math.sin(t*3)*.15;
  }
  dispose(){
    this.group.removeFromParent();this.gun.removeFromParent();this.gunFill.removeFromParent();this.flashLight.removeFromParent();
    for(const mesh of this.instances)mesh.dispose();for(const g of this.geometries.values())g.dispose();for(const m of this.materials.values())m.dispose();for(const t of this.textures)t.dispose();
  }
}
