import * as THREE from 'three/webgpu';
import { pass, uniform, uv, vec2, vec3, vec4, float, dot, pow, max, clamp, abs, sin, length, saturate } from 'three/tsl';
import { RAPIER } from '../engine/PhysicsWorld.js';
const LUMA=vec3(.2126,.7152,.0722);
const _center=new THREE.Vector3(),_roof=new THREE.Vector3(),_p=new THREE.Vector3(),_dir=new THREE.Vector3(),_size=new THREE.Vector2();
/**
 * Red optical pass plus world-linked contacts. It never changes aim or reveals hidden people.
 * The pass was hand-written GLSL over an offscreen target; it is now a TSL RenderPipeline
 * (same luminance, edge, scan-line, and vignette terms, written straight to the screen), so it
 * draws the same on WebGPU and WebGL2. It also filters the tear gas out of the picture.
 */
export class T800Vision {
  constructor(game,fleet,police,scope,{kit,hud,effects,air}){
    this.game=game;this.fleet=fleet;this.police=police;this.kit=kit;this.hud=hud;this.effects=effects;this.air=air;
    this.enabled=false;this.time=0;this.refresh=0;this.contacts=[];this.target=null;
    this.root=document.getElementById('game-app');this.canvas=document.getElementById('vision-tracks');this.ctx=this.canvas.getContext('2d');
    this.w=0;this.h=0;this.pixel=1;
    // The optical pass: luminance gain, edge contrast, scan lines, and a vignette, output as display values.
    const renderer=game.view.renderer;
    this.scenePass=pass(game.view.scene,game.view.camera);
    const image=this.scenePass.getTextureNode('output'),base=image.uvNode||uv();
    this.texel=uniform(new THREE.Vector2(1,1));
    const luma=offset=>dot(saturate(image.sample(base.add(offset)).rgb),LUMA);
    const tx=vec2(this.texel.x,0),ty=vec2(0,this.texel.y);
    const l=dot(saturate(image.sample(base).rgb),LUMA);
    const edge=abs(luma(tx).sub(luma(tx.mul(-1)))).add(abs(luma(ty).sub(luma(ty.mul(-1)))));
    const gain=clamp(pow(max(l,0),.58).mul(1.22).add(edge.mul(.22)),.025,1);
    const scan=sin(base.y.div(this.texel.y).mul(Math.PI)).mul(.03).add(.97);
    const vignette=float(1).sub(length(base.sub(.5).mul(1.2)).mul(.24));
    this.pipeline=new THREE.RenderPipeline(renderer);
    this.pipeline.outputColorTransform=false;
    this.pipeline.outputNode=vec4(vec3(gain,gain.mul(.055),gain.mul(.026)).mul(scan).mul(vignette),1);
    game.view.drawOverride=null;
    this.draw=()=>{
      renderer.getDrawingBufferSize(_size);this.texel.value.set(1/Math.max(1,_size.x),1/Math.max(1,_size.y));
      // The optics filter the tear gas; the clouds stay in the normal view.
      const gas=this.effects.gasGroup,shown=gas.visible;gas.visible=false;
      try{this.pipeline.render();}finally{gas.visible=shown;}
    };
    this.stopResize=kit.onResize((w,h)=>this.size(w,h));
    scope.own(()=>this.dispose());
  }
  toggle(){this.set(!this.enabled);return this.enabled;}
  set(value){
    this.enabled=!!value;this.root.classList.toggle('t800-vision',this.enabled);this.refresh=0;this.contacts.length=0;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.hud.text('vision-mode',this.enabled?'T-800 OPTICS':'NORMAL OPTICS');
    this.game.view.drawOverride=this.enabled?this.draw:null;
  }
  size(width,height){
    const pixel=Math.min(1.5,devicePixelRatio||1);
    this.w=width;this.h=height;this.pixel=pixel;this.canvas.width=Math.round(width*pixel);this.canvas.height=Math.round(height*pixel);this.ctx.setTransform(pixel,0,0,pixel,0,0);
  }
  visible(point,entityId){
    const camera=this.game.view.camera,origin=camera.position;
    _dir.subVectors(point,origin);const distance=_dir.length();if(distance<.01)return false;_dir.multiplyScalar(1/distance);
    _p.copy(point).project(camera);if(_p.z< -1||_p.z>1||Math.abs(_p.x)>1.1||Math.abs(_p.y)>1.1)return false;
    const hit=this.game.runtime.physics.world.castRay(new RAPIER.Ray(origin,_dir),distance+.2,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.game.player.collider,this.game.player.body);
    if(!hit)return true;const id=this.game.runtime.physics.owners.get(hit.collider.handle);
    return id===entityId||id===`shield-${entityId}`;
  }
  acquire(){
    this.contacts=[];const camera=this.game.view.camera;
    for(const v of this.fleet.cars.values()){
      if(v.arriving&&v.arrival<0)continue;
      v.entity.root.localToWorld(_center.set(0,v.info.roof*.72,0));
      v.entity.root.localToWorld(_roof.set(0,v.info.roof+.2,.1));
      if(!this.visible(_center,v.id)&&!this.visible(_roof,v.id))continue;
      this.contacts.push({id:v.id,kind:'vehicle',value:v,point:_center.clone(),distance:camera.position.distanceTo(_center)});
    }
    for(const a of this.police.officers){
      if(!a.active||a.removed)continue;_center.set(a.position.x,a.crouched?1.45:1.9,a.position.z);
      if(!this.visible(_center,a.id))continue;
      this.contacts.push({id:a.id,kind:'human',value:a,point:_center.clone(),distance:camera.position.distanceTo(_center)});
    }
    if(this.air?.hunting&&this.air.lampAlive){
      this.air.lampWorld(_center);
      if(this.visible(_center,'air-unit'))this.contacts.push({id:'air-unit',kind:'air',value:this.air,point:_center.clone(),distance:camera.position.distanceTo(_center)});
    }
    this.contacts.sort((a,b)=>a.distance-b.distance);this.contacts.length=Math.min(32,this.contacts.length);
  }
  bounds(root,min,max){
    const camera=this.game.view.camera;let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){
      const p=root.localToWorld(_p.set(x,y,z)).project(camera);if(p.z< -1||p.z>1)return null;
      const sx=(p.x*.5+.5)*this.w,sy=(-p.y*.5+.5)*this.h;left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
    }
    return {x:left,y:top,w:right-left,h:bottom-top};
  }
  brackets(box,color){
    if(!box||box.w>this.w*.85||box.h>this.h*.8)return;
    const x=this.ctx,l=Math.max(6,Math.min(17,box.w*.19)),{x:bx,y:by,w,h}=box;x.strokeStyle=color;x.lineWidth=1.1;x.beginPath();
    for(const [px,py,sx,sy] of [[bx,by,1,1],[bx+w,by,-1,1],[bx,by+h,1,-1],[bx+w,by+h,-1,-1]]){x.moveTo(px,py+sy*l);x.lineTo(px,py);x.lineTo(px+sx*l,py);}x.stroke();
  }
  render(dt,context={}){
    this.time+=dt;
    const showing=this.enabled&&this.game.running,hud=this.hud;
    hud.hidden('vision-tracks',!showing);hud.hidden('vision-panel',!showing);hud.hidden('vision-header',!showing);
    if(!showing)return;
    this.refresh-=dt;if(this.refresh<=0){this.refresh=.11;this.acquire();}
    const ctx=this.ctx;ctx.clearRect(0,0,this.w,this.h);ctx.font='10px Consolas, monospace';ctx.textBaseline='bottom';
    for(const contact of this.contacts){
      const kind=contact.kind,v=contact.value;let box,label,color;
      if(kind==='human'){if(!v.active||v.removed)continue;box=this.bounds(v.entity.root,[-.43,0,-.35],[.43,v.crouched?1.62:2.2,.58]);color='#ffc2ac';label=`${v.spec.label} / ${v.state.toUpperCase()}`;}
      else if(kind==='air'){if(!v.lampAlive)continue;box=this.bounds(v.heli,[-1.4,-1.4,-2.8],[1.4,1.4,5.6]);color='#bfe4ff';label=`AIR ONE / SEARCHLIGHT ${Math.ceil(v.lampHp/v.lampMax*100)}%`;}
      else {box=this.bounds(v.entity.root,[-v.info.width*.59,0,-v.info.length*.52],[v.info.width*.59,v.info.roof+.4,v.info.length*.52]);color=v.disabled?'#a87168':'#fff0d9';label=`${v.info.label} ${v.label} / ${v.disabled?'DISABLED':'ACTIVE'}`;}
      if(!box)continue;this.brackets(box,color);
      const ty=Math.max(55,box.y-5),tx=Math.max(8,Math.min(this.w-220,box.x));ctx.fillStyle='#260200bb';ctx.fillRect(tx-3,ty-14,Math.min(290,ctx.measureText(label).width+7),17);ctx.fillStyle=color;ctx.fillText(label,tx,ty);
      if(kind==='vehicle')ctx.fillText(`${Math.round(contact.distance)} M`,box.x+2,Math.min(this.h-125,box.y+box.h+15));
    }
    const target=context.target,part=target?.part,vehicle=part?.vehicle;
    if(part&&!part.gone){
      const s=part.spec,offset=s.offset??[0,0,0],box=this.bounds(part.group,s.size.map((v,i)=>offset[i]-v/2),s.size.map((v,i)=>offset[i]+v/2));this.brackets(box,'#ffffff');
    }
    const director=context.director;
    hud.text('vision-phase',director?.wave?`RESPONSE WAVE ${director.wave}`:'CYBERDYNE / INITIAL LINE');
    let cars=0,people=0;for(const c of this.contacts){if(c.kind==='human')people++;else if(c.kind==='vehicle'&&!c.value.disabled)cars++;}
    hud.text('vision-contact-count',`${cars} VEHICLES / ${people} HUMANS${context.gas>.05?' / GAS FILTERED':''}`);
    const air=target?.air;
    hud.text('scan-target',part?vehicle.info.label:target?.human?target.human.spec.label:target?.shield?'PORTABLE SHIELD':air?'AIR ONE':'SEARCHING');
    hud.text('scan-part',part?part.spec.label:target?.human?'PROTECTED HUMAN':target?.shield?'SHIELD PANEL':air?'SEARCHLIGHT LAMP':'NO VISIBLE TARGET');
    hud.text('scan-range',target?.distance?`${target.distance.toFixed(1)} M`:'—');
    hud.text('scan-material',part?(part.spec.kind==='glass'?'GLASS':part.spec.kind==='tire'?'RUBBER':part.spec.kind==='lamp'?'LIGHT LENS':'METAL / COMPOSITE'):target?.human?'HUMAN / DO NOT FIRE':target?.shield?'COMPOSITE SHIELD':air?'LAMP LENS / CREW PROTECTED':'—');
    hud.text('scan-condition',part?`${Math.ceil(part.state.hp/part.state.max*100)}% / ${part.state.stage.toUpperCase()}`:target?.human?target.human.state.toUpperCase():target?.shield?`${Math.ceil(target.shield.shieldHealth/95*100)}%`:air?`${Math.ceil(this.air.lampHp/this.air.lampMax*100)}%`:'—');
    hud.text('scan-drive',vehicle?(vehicle.disabled?'OFFLINE':`ONLINE / ${vehicle.drive.flat??0} FLAT TIRES`):target?.human?'FIRE INHIBIT':target?.shield?'SHIELD CAN BE DISABLED':air?'BREAK THE LAMP TO BLIND IT':'—');
    hud.text('scan-next',director?.phase==='break'?`${Math.ceil(director.countdown)} S`:'LINE ACTIVE');
    hud.text('scan-parts',String(this.fleet.partBreaks));hud.text('scan-integrity',`${Math.ceil(context.health??100)}%`);
    hud.text('scan-focus',context.zoom?'1.8× OPTICAL ZOOM':`1.0× / HOLD ${context.zoomKey??'RIGHT MOUSE'}`);
    this.radar();
  }
  radar(){
    const ctx=this.ctx,x=86,y=this.h-228,r=50;if(this.w<850)return;
    ctx.save();ctx.strokeStyle='#d8665599';ctx.fillStyle='#26070699';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-27,y-42);ctx.moveTo(x,y);ctx.lineTo(x+27,y-42);ctx.stroke();
    const origin=this.game.player.current,yaw=this.game.player.yaw,c=Math.cos(yaw),s=Math.sin(yaw);
    for(const contact of this.contacts){const dx=contact.point.x-origin.x,dz=contact.point.z-origin.z,rx=(dx*c-dz*s)*.73,ry=(dx*s+dz*c)*.73;if(Math.hypot(rx,ry)>r-3)continue;ctx.fillStyle=contact.kind==='human'?'#ff9585':contact.kind==='air'?'#bfe4ff':'#fff0d5';ctx.fillRect(x+rx-2,y+ry-2,4,4);}
    ctx.fillStyle='#fff4dd';ctx.fillRect(x-2,y-2,4,4);ctx.font='9px Consolas, monospace';ctx.fillText('VISIBLE CONTACTS',x-47,y+r+17);ctx.restore();
  }
  dispose(){
    this.stopResize?.();this.game.view.drawOverride=null;this.root.classList.remove('t800-vision');
    this.hud.hidden('vision-tracks',true);this.hud.hidden('vision-panel',true);this.hud.hidden('vision-header',true);this.hud.text('vision-mode','NORMAL OPTICS');
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.pipeline.dispose();this.scenePass.dispose();
  }
}
