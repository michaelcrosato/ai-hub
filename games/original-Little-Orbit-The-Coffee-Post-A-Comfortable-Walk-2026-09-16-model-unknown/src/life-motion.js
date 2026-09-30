import { LIFE_SITES, SMALL_TALK } from './life-spec.js';
import { frameAt, framePoint, coordinates } from './physics.js';
import { norm, len, dot, clamp, vmul, vadd, projectTangent, cross, basis, color } from './math.js';
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function gopherHeight(age){return age<.35?1-ease(age/.35):age<1.75?0:ease((age-1.75)/.75);}
function familyPosition(base,t,index=0){const a=Math.min(1,t/8)*Math.PI*.65;return [base[0]+Math.sin(a)*1.3,base[1],base[2]+(1-Math.cos(a))*.8+Math.sin(t*1.3-index)*.025];}
function birdFlight(age){if(age<=0||age>=5)return [0,.8,0];const a=age/5*Math.PI*2,s=Math.sin(Math.PI*age/5);return [Math.sin(a)*1.8,.8+s*2.3,-s*1.7];}

/** Small rigid-part animation and optional encounter rules. No delivery-state access. */
class LifeMotion{
 constructor(world,state,api){this.w=world.life;this.state=state;this.api=api;this.time=0;this.wait=null;this.walk=null;this.music=null;this.hideStart=-100;this.birdStart=-100;this.rainStart=-100;this.familyTime=0;this.lastNearBird=-100;this.lastRain=-100;this.active=true;this.soundCaption='';}
 say(id,name,text){this.api.say(id,name,text);const a=this.w.actors.find(a=>a.id===id);if(a)a.talkUntil=this.time+1.15;}
 mark(id){const fresh=this.state.remember(id);if(fresh){this.api.note(id);this.api.save();}return fresh;}
 use(a){if(this.wait?.actor.id===a.id)return;this.state.seen.add(a.id);a.lastUse=this.time;this.api.cue('curious');
  if(a.kind==='instrument'){this.music=a;this.playNote(a,a.nextNote++%5);return;}
  if(a.kind==='cloud'){
   if(this.state.cloudStage===0){this.state.cloudStage=1;this.say('brume','Brume','Hmph. Everyone asks for sunshine. I am having a rain day. Stay a moment?');}
   else if(this.state.cloudStage===1){this.wait={kind:'cloud',actor:a,elapsed:0,seconds:4.4};this.say('brume','Brume','No fixing the weather. Just sit with me. We can listen to the rain.');}
   else{this.rainStart=this.time;this.say('brume','Brume','Still grumpy. Less alone. I saved a little drizzle for these flowers.');}
  }
  if(a.kind==='gopher'){
   this.wait={kind:'gopher',actor:a,elapsed:0,seconds:3.0};this.hideStart=this.time;this.say('nibs','Nibs','Oh! A visitor. Wait quietly. I will be right back. Probably.');
  }
  if(a.kind==='bird'){this.birdStart=this.time;this.api.audio.bird(0,.065);this.say('tilly','Tilly','Pree! Pree-prip! You know our song. Here is the flying part.');this.mark('birds');}
  if(a.kind==='tortoise'){
   if(a.id==='moss'){if(!this.walk){this.walk={elapsed:0,actor:a};this.familyTime=0;}this.say('moss','Moss',this.state.memories.has('family')?'Another short walk? We packed extra lettuce.':'We are on our way to a picnic. Walk beside us. There is time.');}
   if(a.id==='fern')this.say('fern','Fern',['We always wait for the smallest feet.','Moss calls this a shortcut. We have been on it all morning.','The picnic is close. Pipkin has stopped to smell one more flower.'][this.state.chat('fern',3)]);
   if(a.id==='pipkin'){this.say('pipkin','Pipkin',['I took twelve steps! Or three. They were very good steps.','That flower is taller than my nose. I like it.','When I grow up, I will still walk slowly. But in more places.'][this.state.chat('pipkin',3)]);this.api.cue('happy');}
  }
  this.api.save();
 }
 playNote(a,index,answer=false){if(!a||a.kind!=='instrument'||!Number.isInteger(index)||index<0||index>4)return;const t=this.time;a.notes[index]=t;a.lastIndex=index;a.lastStrike=t;const fresh=answer?false:this.state.note(a.id,index);this.api.audio.instrument(a.instrument,index);this.soundCaption=(a.instrument==='wood'?'Wood':'Glass')+' · '+['C','D','E','G','A'][index];if(fresh)this.api.note(a.memory);if(!answer)this.api.save();}
 tune(){if(!this.music)return;this.tuneStart=this.time;this.tuneStep=-1;}
 talk(neighbor){const lines=SMALL_TALK[neighbor.id];if(!lines)return;this.say(neighbor.id,neighbor.name,lines[this.state.chat(neighbor.id,lines.length)]);this.api.save();}
 wave(player){for(const a of this.w.actors){if(this.distance(a,player)<5){a.talkUntil=this.time+.85;if(a.kind==='bird')this.birdStart=this.time;if(a.kind==='cloud')this.rainStart=this.time;}}}
 distance(a,player){return Math.acos(clamp(dot(a.n,player.n),-1,1))*26;}
 prompt(a){if(a.kind==='cloud')return this.state.cloudStage===0?'Listen to Brume':this.state.cloudStage===1?'Stay for a little rain':'Ask Brume for a drizzle';if(a.kind==='gopher')return 'Wait quietly for Nibs';if(a.kind==='bird')return 'Whistle to the hedge choir';if(a.kind==='tortoise')return a.id==='moss'?'Walk with the family':'Say hello to '+a.name;return 'Play '+a.name;}
 update(dt,player,running=false){
  this.time+=dt;const t=this.time,quiet=this.api.reduced?0:1;
  if(this.music&&(this.distance(this.music,player)>3.5||!this.active)){this.music=null;this.tuneStart=null;}
  if(this.tuneStart!=null&&this.music){const i=Math.floor((t-this.tuneStart)/.28);if(i<5&&i!==this.tuneStep){this.tuneStep=i;this.playNote(this.music,[0,2,3,4,2][i],true);}if(i>=5)this.tuneStart=null;}
  if(this.wait){const v=this.wait,d=this.distance(v.actor,player);if(d>3.6||running&&player.moving){this.wait=null;this.api.toast('Take your time. You can return to this small moment.');}else {v.elapsed+=dt;if(v.elapsed>=v.seconds){this.wait=null;if(v.kind==='cloud'){this.state.cloudStage=2;this.rainStart=t;this.say('brume','Brume','You stayed. Look. The flowers needed a rain day too.');this.mark('cloud');}else{this.hideStart=-100;this.say('nibs','Nibs','Back! This pebble was hiding with me. It can stay where you can see it.');this.mark('gopher');}this.api.save();}}}
  if(this.walk){if(this.distance(this.walk.actor,player)<5.5){this.walk.elapsed+=dt;this.familyTime=this.walk.elapsed;}if(this.walk.elapsed>=8){this.walk=null;this.say('moss','Moss','Here we are. A fine walk. Even better with company. Have a seat by the lettuce.');this.mark('family');this.api.save();}}
  for(const a of this.w.actors){
   if(this.distance(a,player)<6)this.state.seen.add(a.id);
   const talk=t<a.talkUntil,head=a.node.find('head');if(head){head.rotation[2]=quiet*Math.sin(t*(talk?8:.8))*(talk?.055:.027);head.rotation[1]=quiet*Math.sin(t*.6)*.075;}
   for(const s of ['L','R']){const eye=a.node.find('eye_'+s);if(eye){const seed=a.id.length*.31,blink=((t+seed)%4.8)<.15;eye.scale[1]=(a.kind==='cloud'?.092:a.kind==='bird'?.056:a.kind==='gopher'?.072:.060)*(blink?.12:1);}}
   if(a.kind==='cloud'||a.kind==='bird'||a.kind==='gopher'){
    // Face the listener without tilting away from the local ground.
    const d=projectTangent(player.n,a.n),m=a.root.matrix;const target=Math.atan2(dot(d,[m[0],m[1],m[2]]),dot(d,[m[8],m[9],m[10]]));if(this.distance(a,player)<7)a.node.rotation[1]=target;
   }
   a.prompt=this.prompt(a);
  }
  const c=this.w.cloud,calm=this.state.cloudStage===2;c.node.position[1]=2.85+quiet*Math.sin(t*.8)*.09;c.node.rotation[2]=quiet*Math.sin(t*.7)*.025;
  c.node.find('frown').visible=!calm;c.node.find('smile').visible=calm;c.node.find('mouth_talk').visible=t<c.talkUntil;
  if(t<c.talkUntil){c.node.find('frown').visible=false;c.node.find('smile').visible=false;c.node.find('mouth_talk').scale[1]=.7+.3*Math.sin(t*17);}
  c.node.find('brow_L').rotation[2]=calm?.07:-.28;c.node.find('brow_R').rotation[2]=calm?-.07:.28;
  for(const p of c.node.find('puffs').children)p.tint=[...color(calm?'#b6bdc5':'#96a3b4'),1];
  c.flowers.forEach(n=>n.visible=calm);c.rainbow.visible=calm&&t-this.rainStart<6;
  if(this.active&&this.distance(c,player)<7&&t-this.lastRain>.85){this.lastRain=t;this.api.audio.noise?.(1.1,.017*(1-this.distance(c,player)/8),calm?1700:2300,0,'rain');}
  c.rain.visible=this.distance(c,player)<32;c.rain.children.forEach((n,i)=>{n.position[1]=.2+(1-((t*(calm?.60:1.4)+i*.17)%1))*2.18;n.visible=!this.api.reduced||i<7;});
  const g=this.w.gopher,d=this.distance(g,player);
  if(d<2.7&&running&&player.moving&&!this.wait&&t-this.hideStart>3.2){this.hideStart=t;this.say('nibs','Nibs','Zip! Too many footsteps. I will try the other door.');}
  const age=t-this.hideStart,height=gopherHeight(age);
  if(age>.4&&age<1.7&&!this.changedHole){g.holeIndex=(g.holeIndex+1)%g.holes.length;this.changedHole=true;}
  if(age>2.5)this.changedHole=false;
  const p=g.holes[g.holeIndex];g.node.position=[p[0],p[1]-.90*(1-height),p[2]];g.node.visible=height>.02;g.node.scale[1]=1.05*(.94+.06*height);Object.assign(g,this.w.atPoint(g.root,p));g.pebble.visible=this.state.memories.has('gopher');
  const b=this.w.bird,flight=t-this.birdStart;b.node.position=birdFlight(flight);const flying=flight>0&&flight<5;
  [b.node,...b.friends].forEach((n,i)=>{n.find('wing_L').rotation[2]=(flying||t<b.talkUntil?Math.sin(t*26+i)*.8:.04*Math.sin(t*2))*quiet;n.find('wing_R').rotation[2]=-n.find('wing_L').rotation[2];n.find('beak').rotation[0]=t<b.talkUntil?.25+.15*Math.sin(t*25):0;if(i)n.position[1]=.47+(t<b.talkUntil?Math.abs(Math.sin(t*8+i))*.14*quiet:0);});
  if(this.active&&this.distance(b,player)<9&&t-this.lastNearBird>17){this.lastNearBird=t;this.api.audio.bird(0,.022);}
  this.w.family.forEach((a,i)=>{const p=familyPosition(a.base,this.familyTime,i);p[1]+=quiet*(this.walk?Math.abs(Math.sin(t*3.2+i))*.018:0);a.node.position=p;Object.assign(a,this.w.atPoint(a.root,p));a.node.rotation[1]=this.walk?.4:Math.PI+.16*i;for(const s of [-1,1])for(const z of [-1,1])a.node.find('foot_'+s+'_'+z).rotation[0]=this.walk?Math.sin(t*3.2+i+s*z)*.19*quiet:0;});
  this.w.picnic.visible=this.state.memories.has('family');
  for(const a of this.w.instruments){a.keys.forEach((n,i)=>{const age=t-a.notes[i],amp=age<.75?Math.sin(age*17)*Math.exp(-age*5):0;n.position[1]=a.rest[i][1]+amp*.10*quiet;n.rotation[2]=a.instrument==='glass'?amp*.13*quiet:0;a.glow[i].visible=this.state.notes[a.id].has(i);});const m=a.node.find('mallet');if(m){const age=t-(a.lastStrike??-100);m.rotation[2]=age<.6?Math.sin(age*16)*Math.exp(-age*4)*.55*quiet:0;m.position[0]=((a.lastIndex??2)-2)*.34;}}
  this.w.flock.forEach((b,i)=>{const a=t*.043+b.phase,u=a*26,v=8+Math.sin(a*1.6)*11,h=8+i*.4;b.root.matrix=frameAt(u,v);b.node.position=[0,h,0];b.node.rotation[1]=Math.PI/2;b.node.find('wing_L').rotation[2]=Math.sin(t*9+i)*.7*quiet;b.node.find('wing_R').rotation[2]=-b.node.find('wing_L').rotation[2];});
 }
 snapshot(){return {time:this.time,wait:this.wait?{kind:this.wait.kind,elapsed:this.wait.elapsed}:null,walk:this.walk?.elapsed??null,gopherVisible:this.w.gopher.node.visible,hole:this.w.gopher.holeIndex,music:this.music?.id||null,familyTime:this.familyTime};}
}

export { gopherHeight, familyPosition, birdFlight, LifeMotion };
