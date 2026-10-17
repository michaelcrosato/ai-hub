(() => {
const G=Drive;
G.bindings={
 up:['ArrowUp','KeyW','Pad12'],down:['ArrowDown','KeyS','Pad13'],left:['ArrowLeft','KeyA','Pad14'],right:['ArrowRight','KeyD','Pad15'],
 north:['KeyW'],south:['KeyS'],west:['KeyA'],east:['KeyD'],aimUp:['ArrowUp'],aimDown:['ArrowDown'],aimLeft:['ArrowLeft'],aimRight:['ArrowRight'],
 start:['Enter','Pad9'],pause:['Escape','Pad9'],confirm:['Enter','Space','Pad0'],cancel:['Escape','KeyK','Pad1'],
 jump:['Space','Pad0'],dodge:['KeyK','Pad1'],reload:['KeyR','Pad2'],interact:['KeyE','Pad3'],crew:['KeyQ','Pad4'],cover:['KeyF','Pad5'],aim:['Mouse2','Pad6'],fire:['KeyJ','Mouse0','Pad7'],sprint:['ShiftLeft','Pad10'],ability:['KeyV','Pad11'],previous:['KeyZ','Pad14'],next:['KeyC','Pad15'],map:['KeyM','Pad12'],crouch:['ControlLeft','Pad13']
};
G.Physical = class {
 constructor(app) {
  this.app=app;this.seq=0;this.last=0;this.active=false;this.device='keyboard';this.keys=new Set();this.pointers=new Set();this.padState=new Map();this.synthetic=[];this.visible=true;this.focused=true;
  if(typeof window==='undefined')return;
  const signal=app.game._abort.signal;
  const on=(target,type,fn)=>target.addEventListener(type,fn,{capture:true,signal,passive:false});
  const activity=(e,device,held)=>{this.focused=true;this.device=device;this.seq++;this.last=app.clock;app.idle=0;if(held!==undefined){const set=device==='keyboard'?this.keys:this.pointers;held?set.add(e.code??e.pointerId??0):set.delete(e.code??e.pointerId??0);} if(app.mode==='demo'||app.guard){e.preventDefault();e.stopImmediatePropagation();if(app.mode==='demo')app.interrupt();}};
  on(window,'keydown',e=>activity(e,'keyboard',true));on(window,'keyup',e=>activity(e,'keyboard',false));
  on(window,'pointerdown',e=>activity(e,e.pointerType==='touch'?'touch':'mouse',true));on(window,'pointerup',e=>activity(e,e.pointerType==='touch'?'touch':'mouse',false));
  on(window,'pointercancel',e=>activity(e,'touch',false));
  on(window,'pointermove',e=>{if(e.movementX||e.movementY||e.pointerType==='touch')activity(e,e.pointerType==='touch'?'touch':'mouse');});
  on(window,'wheel',e=>activity(e,'mouse'));
  on(window,'blur',()=>{this.focused=false;this.keys.clear();this.pointers.clear();this.padState.clear();app.idle=0;});
  on(window,'focus',()=>{this.focused=true;app.idle=0;});
  on(document,'visibilitychange',()=>{this.visible=!document.hidden;this.keys.clear();this.pointers.clear();app.idle=0;app.game.input.clear();if(this.visible&&app.mode==='demo')app.game.resume();});
 }
 // Tests inject device observations, never bot action frames.
 inject(event){this.synthetic.push(event);}
 poll(){
  let active=this.keys.size>0||this.pointers.size>0,pads=[];
  try {pads=Array.from(navigator.getGamepads?.()||[]);}catch{}
  for(const p of pads.filter(Boolean)){if(p.connected===false)continue;const v=[...p.axes.map(a=>Math.abs(a)>(this.app.game.input.deadzone??.18)?Math.round(a*100)/100:0),...p.buttons.map(b=>b.value>(this.app.game.settings.sdTrigger??.08)?Math.round(b.value*100)/100:b.pressed?1:0)];const old=this.padState.get(p.index);if(v.some(Boolean)){active=true;this.device='gamepad';if(!old||v.some((x,i)=>x!==old[i])){this.seq++;this.last=this.app.clock;this.app.idle=0;}}this.padState.set(p.index,v);}
  for(const e of this.synthetic.splice(0)){this.seq++;this.last=this.app.clock;this.app.idle=0;this.device=e.device||'keyboard';active=!!e.active;}
  this.active=active;return {seq:this.seq,active,device:this.device,visible:this.visible};
 }
};
G.playerAction=(app)=>{
 const I=app.game.input,f=I.sourceFrame('physical'),a=G.emptyAction('physical'),s=app.session,c=s.controlled;
 a.held=f.held;a.pressed=f.pressed;a.released=f.released;
 const dx=(I.down('east')?1:0)-(I.down('west')?1:0),dy=(I.down('south')?1:0)-(I.down('north')?1:0);
 const m=Math.hypot(...I.padMove)>.01?I.padMove:[dx,dy],len=Math.max(1,Math.hypot(...m));
 a.move=c.zone==='gantry'?[m[0],-m[1]]:app.game.view.screenDirToGround(m[0]/len,m[1]/len);
 a.steer=Math.hypot(...I.padMove)>.01?I.padMove[0]:dx;a.throttle=Math.max(f.values[7]||0,I.down('north')?1:0);a.brake=Math.max(f.values[6]||0,I.down('south')?1:0);
 let aim=I.padAim||[(I.down('aimRight')?1:0)-(I.down('aimLeft')?1:0),(I.down('aimDown')?1:0)-(I.down('aimUp')?1:0)];
 if(I.aimSource==='mouse'&&I.mouse.active&&!app.game.headless){const point=app.game.mouseGround();if(point)aim=Array.isArray(point)?[point[0]-c.x,point[1]-c.y]:[point.x-c.x,point.y-c.y];a.aim=aim;}else a.aim=c.zone==='gantry'?[aim[0],-aim[1]]:app.game.view.screenDirToGround(...aim);
 if(app.assist&&app.game.settings.sdAimStrength!==0&&a.held.aim&&!c.vehicle&&Math.hypot(...a.aim)>.1){const facing=Math.atan2(a.aim[1],a.aim[0]);const target=s.actors.filter(o=>o.enabled&&!o.dead&&(o.team==='guard'||o.team==='police')&&o.zone===c.zone&&G.dist(c,o)<220&&Math.abs(G.angle(Math.atan2(o.y-c.y,o.x-c.x)-facing))<.08+.2*(app.game.settings.sdAimStrength??.7)&&s.queryClear(c,o)).sort((x,y)=>G.dist(c,x)-G.dist(c,y))[0];if(target)a.aim=[target.x-c.x,target.y-c.y];}
 const n=Math.hypot(...a.aim);if(n>0)a.aim=a.aim.map(x=>x/n);
 return a;
};
})();
