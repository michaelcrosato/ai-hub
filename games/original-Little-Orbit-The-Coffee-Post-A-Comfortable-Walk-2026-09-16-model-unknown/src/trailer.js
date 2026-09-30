/** Six directed shots. This is an asset render, not a recorded player session. */
import { Node } from './engine.js';
import { CharacterMotion } from './character-motion.js';
import { EspressoMotion } from './espresso-motion.js';
import { COFFEE_SLOTS } from './courier-spec.js';
import { frameAt, framePoint, normalAt } from './physics.js';
import { compose, mmul, vmul, norm, mixv, clamp, transform } from './math.js';
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
class TrailerDirector{
 constructor(renderer,world,assets){
  this.renderer=renderer;this.world=world;this.assets=assets;this.duration=30;this.active=false;
  this.sets=world.dynamics.filter(n=>!['courier_root','kindness_particles','cafe_machine_root','pip'].includes(n.name)).map(n=>n.clone());
  this.actorRoot=new Node('trailer_courier');this.actor=assets.get('codey');this.actorRoot.add(this.actor);this.motion=new CharacterMotion(this.actor,{seed:907});
  this.cups=[];const tray=this.actor.find('tray');for(let i=0;i<4;i++){const c=assets.get('coffee');c.position=[...COFFEE_SLOTS[i]];tray.add(c);this.cups.push(c);}
  const steam=new Node('trailer_coffee_steam');steam.transparent=true;tray.add(steam);this.steam=[];
  for(let i=0;i<8;i++){const n=steam.part('smooth','#f5efda',[0,0,0],[.02,.07,.02]);n.unlit=true;this.steam.push(n);}
  this.friendRoot=new Node('trailer_friend');this.friend=assets.get('fox');this.friendRoot.add(this.friend);this.friendMotion=new CharacterMotion(this.friend,{seed:312});
  this.gift=assets.get('coffee');this.gift.position=[.59,.70,.30];this.gift.scale=[.8,.8,.8];this.friend.add(this.gift);
  this.machineRoot=new Node('trailer_espresso');this.machineRoot.matrix=frameAt(0,0);this.machine=assets.get('espresso_machine');this.machine.position=[-2.76,1.42,-.65];this.machine.scale=[.68,.68,.68];this.machine.rotation=[0,Math.PI/2,0];this.machineRoot.add(this.machine);this.espresso=new EspressoMotion(this.machine);
  this.lastShot=-1;this.output=document.createElement('canvas');this.ctx=this.output.getContext('2d',{alpha:false});
 }
 pose(m,t,moving=false,wave=-100,joy=-100){
  m.time=t;m.move=moving?1:0;m.stride=t*7.2;m.nextBlink=t+10;m.blinkStart=Math.floor(t/3.9)*3.9+.25;
  m.waveStart=wave;m.joyStart=joy;m.nodStart=joy;m.lookYaw=.10;m.lookPitch=0;
  m.update(0,{moving:moving?1:0,look:{yaw:.1,pitch:0}});
 }
 shotAt(t){return Math.min(5,Math.floor(Math.max(0,t)/5));}
 /** The largest centred 16:9 rectangle of the game canvas, in CSS pixels. The shots are framed for it. */
 frame(){const {width,height}=this.renderer.kit.size,w=Math.min(width,height*16/9),h=w*9/16;return {x:Math.round((width-w)/2),y:Math.round((height-h)/2),w:Math.round(w),h:Math.round(h)};}
 draw(seconds,viewport=this.frame()){
  const t=clamp(seconds,0,29.999999),shot=this.shotAt(t),s=(t-shot*5)/5,q=ease(s),r=this.renderer;
  let eye,target,up,sun,shift=0,fov=46,shadow=true;
  this.actorRoot.visible=false;this.friendRoot.visible=false;
  this.machineRoot.visible=true;this.espresso.update(t,shot===1?{start:5.25,duration:4.2}:null);
  this.pose(this.motion,t,false);this.pose(this.friendMotion,t,false);
  this.gift.visible=shot===2&&t>=13.05;
  for(let i=0;i<4;i++)this.cups[i].visible=!(shot===2&&t>=13.05&&i===3);
  for(let i=0;i<8;i++){const c=this.cups[Math.floor(i/2)],p=this.steam[i],phase=(t*.65+i*.23)%1;p.visible=c.visible;p.position=[c.position[0]+Math.sin(t+i)*.015,c.position[1]+.48+phase*.30,c.position[2]];p.scale=[.010+phase*.008,.032+phase*.018,.010+phase*.008];p.tint[3]=.30*(1-phase);}
  if(shot===0){
   eye=vmul(norm(mixv([-.22,1,.60],[.12,1,.42],q)),88-8*q);target=[0,2,0];up=[0,0,1];sun=norm([-.45,1,-.65]);fov=49;shadow=false;
  }else if(shot===1){
   const m=frameAt(0,0);eye=framePoint(m,mixv([.68,3.14,1.14],[-.30,2.79,1.12],q));target=framePoint(m,[-2.65,2.21,-.60]);up=[0,1,0];sun=norm([1.2,1.7,-.6]);fov=41;
  }else if(shot===2){
   const m=frameAt(-3.6,10.7);const progress=ease(Math.min(1,s/.61)),z=-1.45+1.92*progress;
   this.actorRoot.visible=true;this.actorRoot.matrix=mmul(m,compose([.05,-.02,z],[0,-.16,0]));
   this.pose(this.motion,t,s<.58,-100,12.6);this.friendRoot.visible=true;this.friendRoot.matrix=mmul(m,compose([-1.17,-.10,2.13],[0,1.18,0]));this.pose(this.friendMotion,t,false,12.25,12.6);
   eye=framePoint(m,mixv([4.7,3.10,7.05],[3.2,2.55,6.2],q));target=framePoint(m,[-.25,1.13,.92]);up=[m[4],m[5],m[6]];sun=norm(transform(m,[-.6,1.5,1.0],0));fov=42;
  }else if(shot===3){
   const m=frameAt(13,9),x=-.25+s*5.45,y=3.35+.34*Math.sin((x+.6)/6.4*Math.PI);
   this.actorRoot.visible=true;this.actorRoot.matrix=mmul(m,compose([x,y,-.70],[0,Math.PI/2,0]));this.pose(this.motion,t,true);
   eye=framePoint(m,mixv([8.8,8.65,12.5],[3.2,7.6,12.0],q));target=framePoint(m,[1.8,3.9,-.72]);up=[m[4],m[5],m[6]];sun=norm(transform(m,[-.7,1.7,.6],0));fov=48;
  }else if(shot===4){
   const m=this.world.sunroom.root.matrix;eye=framePoint(m,mixv([3.1,3.98,7.9],[.90,3.1,6.2],q));target=framePoint(m,[0,2.98,-2.74]);up=[m[4],m[5],m[6]];sun=norm(transform(m,[-.5,1.6,1.1],0));fov=46;
  }else{
   eye=vmul(norm(mixv([.04,1,.43],[.28,1,.58],q)),79+14*q);target=[0,0,0];up=[0,0,1];sun=norm([-.45,1,-.65]);shift=-.44*ease(s/.40);fov=51;shadow=false;
  }
  // Cinematic frames refresh the shadow map every frame, so a cut never shows the last shot's shadows.
  r.cinematic=true;this.lastShot=shot;
  this.dynamics||=[...this.sets,this.machineRoot,this.actorRoot,this.friendRoot];r.setDynamic(this.dynamics);
  r.render({eye,target,up,fov:fov*Math.PI/180,shift,yshift:0,sun,focus:target,focusUp:up,shadows:shadow,viewport});
  this.current={t,shot,eye,target,up,stats:{...r.stats}};return this.current;
 }
 composite(seconds){
  // The 3D frame is drawn into a 16:9 window of the game canvas, then copied here in the same frame.
  const view=this.frame();this.draw(seconds,view);
  const source=this.renderer.gl.domElement,ratio=source.width/Math.max(1,this.renderer.kit.size.width);
  const W=Math.max(2,Math.round(view.w*ratio)),H=Math.max(2,Math.round(view.h*ratio)),c=this.output,x=this.ctx;
  if(c.width!==W||c.height!==H){c.width=W;c.height=H;}
  let g=x.createRadialGradient(W*.56,H*.42,0,W*.56,H*.42,W*.70);g.addColorStop(0,'#f9efdb');g.addColorStop(.68,'#e8e3d0');g.addColorStop(1,'#cbd4c5');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.drawImage(source,Math.round(view.x*ratio),Math.round(view.y*ratio),W,H,0,0,W,H);
  g=x.createRadialGradient(W*.5,H*.5,H*.25,W*.5,H*.5,W*.62);g.addColorStop(0,'#223a3200');g.addColorStop(1,'#223a322b');x.fillStyle=g;x.fillRect(0,0,W,H);
  const scale=W/1920,bar=H*.068;x.fillStyle='#263a33';x.fillRect(0,0,W,bar);x.fillRect(0,H-bar,W,bar);
  const t=Math.min(30,Math.max(0,seconds)),shot=this.shotAt(Math.min(t,29.99)),s=t-shot*5;
  const fade=clamp(Math.min((s-.55)/.55,(4.72-s)/.5),0,1);
  const spaced=(text,xx,yy,font,spacing)=>{x.font=font;for(const letter of text){x.fillText(letter,xx,yy);xx+=x.measureText(letter).width+spacing;}};
  x.textAlign='left';x.textBaseline='alphabetic';
  if(shot===0&&fade>0){x.save();x.globalAlpha=fade;x.fillStyle='#395547';spaced('THE COFFEE POST',W*.073,H*.205,`${17*scale}px Arial`,4.5*scale);x.font=`${59*scale}px Georgia`;x.fillText('A small world.',W*.073,H*.276);x.font=`italic ${47*scale}px Georgia`;x.fillText('A warm beginning.',W*.073,H*.329);x.restore();}
  const captions={1:'Every morning starts here.',2:'Four coffees. Four small hellos.',3:'Take the long way round.',4:'Leave room for a little wonder.'};
  if(captions[shot]&&fade>0){x.save();x.globalAlpha=fade;x.textAlign='center';x.fillStyle='#fbf3df';x.font=`${27*scale}px Georgia`;x.fillText(captions[shot],W*.5,H-bar*.36);x.restore();}
  if(shot===5){const a=clamp((s-.50)/.75,0,1);x.save();x.globalAlpha=a;x.fillStyle='#365449';spaced('THE COFFEE POST',W*.091,H*.285,`${17*scale}px Arial`,4.4*scale);x.font=`${127*scale}px Georgia`;x.fillText('Little',W*.087,H*.428);x.fillStyle='#b9704e';x.font=`italic ${143*scale}px Georgia`;x.fillText('Orbit.',W*.086,H*.565);x.fillStyle='#486152';x.font=`${27*scale}px Georgia`;x.fillText('Good coffee. A little closer.',W*.091,H*.642);spaced('A QUIET SINGLE-PLAYER ADVENTURE',W*.091,H*.725,`${14*scale}px Arial`,2*scale);x.restore();}
  const black=1-Math.min(1,t/.65,(30-t)/.70);if(black>0){x.globalAlpha=clamp(black,0,1);x.fillStyle='#263a33';x.fillRect(0,0,W,H);x.globalAlpha=1;}
  return c;
 }
 capture(seconds){return this.composite(seconds).toDataURL('image/png');}
}
export { TrailerDirector };
