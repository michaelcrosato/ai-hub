import { clamp, lerp, seeded } from './math.js';

/** Small pose rig. No skinning, morph targets, or animation downloads.
 * Cache the named nodes once. Always pose from the authored rest transform.
 * The rig does not change the player position, collisions, or delivery state.
 */
const MOTION={blinkDuration:.20,blinkGap:3.0,blinkSpread:2.3,headYaw:.42,headPitch:.19,waveSeconds:1.8,joySeconds:1.8};
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const envelope=(age,duration)=>age<0||age>duration?0:ease(age/.18)*ease((duration-age)/.30);
function blinkAmount(age,duration=MOTION.blinkDuration){
 const x=age/duration;
 return x<0||x>1?0:x<.32?ease(x/.32):x<.55?1:1-ease((x-.55)/.45);
}
class CharacterMotion{
 constructor(model,{seed=14,reduced=false}={}){
  this.model=model;this.reduced=reduced;this.time=0;this.stride=0;this.move=0;this.lookYaw=0;this.lookPitch=0;this.random=seeded(seed);this.nextBlink=1.2+this.random()*2;
  this.blinkStart=-100;this.joyStart=-100;this.waveStart=-100;this.curiousStart=-100;this.nodStart=-100;this.brewStart=-100;this.lastBlink=0;
  this.nodes=new Map();this.rest=new Map();
  const visit=n=>{this.nodes.set(n.name,n);this.rest.set(n,{p:[...n.position],r:[...n.rotation],s:[...n.scale]});for(const c of n.children)visit(c);};visit(model);
  this.head=this.get('head');this.body=this.get('body');this.tray=this.get('tray');this.tail=this.get('tail');
  this.eyes=[this.get('eye_L')||this.get('eye_-0.21'),this.get('eye_R')||this.get('eye_0.21')];
  this.happyEyes=[this.get('happy_eye_L'),this.get('happy_eye_R')];
 }
 get(name){return this.nodes.get(name)||null;}
 cue(kind){
  if(kind==='blink'){this.blinkStart=this.time;this.nextBlink=this.time+MOTION.blinkGap+this.random()*MOTION.blinkSpread;}
  if(kind==='wave')this.waveStart=this.time;
  if(kind==='happy'||kind==='deliver'){this.joyStart=this.time;this.nodStart=this.time;if(kind==='deliver')this.waveStart=this.time;}
  if(kind==='curious')this.curiousStart=this.time;
  if(kind==='brew'){this.brewStart=this.time;this.nodStart=this.time;}
 }
 resetPose(n){if(!n)return;const b=this.rest.get(n);n.position=[...b.p];n.rotation=[...b.r];n.scale=[...b.s];}
 update(dt,{moving=0,running=false,look=null,grounded=true}={}){
  dt=clamp(Number.isFinite(dt)?dt:0,0,.10);this.time+=dt;
  const t=this.time;this.move=lerp(this.move,moving?1:0,1-Math.exp(-dt*12));this.stride+=dt*(running?12:9)*this.move;
  if(t>=this.nextBlink){this.blinkStart=t;this.nextBlink=t+MOTION.blinkGap+this.random()*MOTION.blinkSpread;}
  const blink=blinkAmount(t-this.blinkStart);this.lastBlink=blink;
  const joy=envelope(t-this.joyStart,MOTION.joySeconds),wave=envelope(t-this.waveStart,MOTION.waveSeconds),curious=envelope(t-this.curiousStart,2.3);
  const nod=envelope(t-this.nodStart,1.1)*Math.sin((t-this.nodStart)*7.5);
  const brew=envelope(t-this.brewStart,1.8),quiet=this.reduced?0:1,step=Math.sin(this.stride),sway=quiet*step*.023*this.move;
  this.resetPose(this.model);
  this.model.position[1]+=quiet*(Math.abs(step)*.045*this.move+(1-this.move)*(.011+.011*Math.sin(t*2.1)));
  this.model.rotation[2]+=sway;
  this.resetPose(this.body);if(this.body)this.body.scale[1]*=1+quiet*.008*Math.sin(t*2.1);
  const desiredYaw=look?clamp(look.yaw,-MOTION.headYaw,MOTION.headYaw):quiet*Math.sin(t*.62)*Math.sin(t*.23)*.105;
  const desiredPitch=look?clamp(look.pitch,-MOTION.headPitch,MOTION.headPitch):0;
  this.lookYaw=lerp(this.lookYaw,desiredYaw,1-Math.exp(-dt*5));this.lookPitch=lerp(this.lookPitch,desiredPitch,1-Math.exp(-dt*5));
  this.resetPose(this.head);
  if(this.head){
   this.head.rotation[1]+=quiet*this.lookYaw;
   this.head.rotation[0]+=quiet*(this.lookPitch+nod*.12+brew*.13);
   this.head.rotation[2]+=quiet*(Math.sin(t*1.05)*.027+curious*.19-sway*.55);
  }
  const eyesSmile=joy>.55&&(t-this.joyStart)<1.25&&blink<.25;
  for(let i=0;i<2;i++){
   const eye=this.eyes[i];this.resetPose(eye);
   if(eye){eye.visible=!(eyesSmile&&this.happyEyes[i]);eye.scale[1]*=Math.max(.085,1-blink);}
   if(this.happyEyes[i])this.happyEyes[i].visible=eyesSmile;
   const shine=this.get('eye_glint_'+(i?'R':'L'));if(shine)shine.visible=blink<.55;
  }
  const smile=this.get('mouth_smile'),open=this.get('mouth_happy');
  if(smile)smile.visible=!(open&&joy>.35);if(open)open.visible=joy>.35;
  for(const [side,sign]of [['L',-1],['R',1]]){
   const leg=this.get('leg_'+side),arm=this.get('arm_'+side);this.resetPose(leg);this.resetPose(arm);
   if(leg){leg.rotation[0]+=quiet*step*.42*this.move*sign;if(!grounded)leg.rotation[0]+=quiet*sign*.14;}
   if(arm){
    arm.rotation[0]-=quiet*step*.20*this.move*sign;
    // The right paw moves out from the body. The harness keeps the tray level.
    if(side==='R'){arm.rotation[2]+=wave*(1.92+quiet*Math.sin((t-this.waveStart)*14)*.16);arm.rotation[0]-=wave*.20;}
   }
  }
  this.resetPose(this.tail);if(this.tail){this.tail.rotation[1]+=quiet*Math.sin(t*(2.2+joy))*(.105+joy*.13);this.tail.rotation[2]+=quiet*step*this.move*.065;}
  this.resetPose(this.tray);if(this.tray){this.tray.rotation[2]-=sway*.85;this.tray.position[1]-=quiet*Math.abs(step)*.028*this.move;}
  for(const side of ['L','R']){const ear=this.get('ear_'+side);this.resetPose(ear);if(ear)ear.rotation[2]+=quiet*curious*(side==='L'?-.055:.045);}
 }
 snapshot(){return {time:this.time,blink:this.lastBlink,head:this.head?[...this.head.rotation]:null,smile:this.get('mouth_smile')?.visible,happy:this.get('mouth_happy')?.visible,eyeScale:this.eyes.map(n=>n?[...n.scale]:null),rightArm:this.get('arm_R')?.rotation.slice()};}
}

export { MOTION, blinkAmount, CharacterMotion };
