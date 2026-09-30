/** Named-part motion shared by the game and the Three.js adapter.
 * Coordinates use glTF conventions: Y up, +Z front. No engine import is needed.
 * Do not run this controller and a Three.js AnimationMixer on the same parts.
 */
const ESPRESSO_DURATION=4.2;
const ESPRESSO_PARTS=['pressure_needle','brew_lever','brew_button_left','brew_button_right','steam_valve','steam_wand','portafilter_left','portafilter_right','tank_lid','drip_tray','coffee_stream_left','coffee_stream_right','status_light'];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const axis=['x','y','z'];
function read(v){return Array.isArray(v)?[...v]:[v.x,v.y,v.z];}
function write(v,a){if(Array.isArray(v)){v[0]=a[0];v[1]=a[1];v[2]=a[2];}else v.set(a[0],a[1],a[2]);}
function component(v,i,value){if(Array.isArray(v))v[i]=value;else v[axis[i]]=value;}
function descendants(n,fn){fn(n);for(const c of n.children||[])descendants(c,fn);}
function espressoSample(seconds){
 const t=Math.max(0,Math.min(1,seconds/ESPRESSO_DURATION));
 const envelope=smooth(t/.16)*(1-smooth((t-.84)/.16));
 const flow=smooth((t-.24)/.09)*(1-smooth((t-.80)/.06));
 return {needle:2.42-3.52*envelope+.045*Math.sin(seconds*17)*envelope,lever:-.53*envelope,valve:.43*envelope,wand:-.13*envelope,button:-.027*smooth(t/.04)*(1-smooth((t-.12)/.06)),flow:Math.max(.001,flow),envelope};
}
class EspressoMotion{
 constructor(root,{reduced=false}={}){
  this.root=root;this.reduced=reduced;this.parts={};this.base={};this.demo=null;this.open=false;this.openAmount=0;this.last=0;this.state={};
  this.find=name=>root.getObjectByName?root.getObjectByName(name):root.find(name);
  for(const name of [...ESPRESSO_PARTS,...Array.from({length:5},(_,i)=>'steam_puff_'+i)]){
   const n=this.find(name);if(!n)throw new Error('Espresso asset is missing named part: '+name);
   this.parts[name]=n;this.base[name]={p:read(n.position),r:read(n.rotation),s:read(n.scale)};
  }
  for(let i=0;i<5;i++){
   const n=this.parts['steam_puff_'+i];n.transparent=true;
   descendants(n,c=>{if(c.material){c.material=c.material.clone();c.material.transparent=true;c.material.depthWrite=false;}if(c.mesh)c.unlit=true;});
  }
  descendants(this.parts.status_light,n=>{if(n.material)n.material=n.material.clone();});
  this.update(0,null);
 }
 cue(kind,time){
  if(kind==='open'){this.demo=null;this.open=!this.open;return;}
  if(kind!=='brew'&&kind!=='steam')throw new Error('Unknown espresso cue: '+kind);
  this.demo={kind,start:time};this.open=false;
 }
 update(time,brew=null){
  const dt=Math.min(.06,Math.max(0,time-this.last));this.last=time;
  if(this.demo&&time-this.demo.start>(this.demo.kind==='brew'?ESPRESSO_DURATION:2.8))this.demo=null;
  const active=brew||this.demo?.kind==='brew';
  const elapsed=brew?(time-brew.start)*ESPRESSO_DURATION/brew.duration:this.demo?.kind==='brew'?time-this.demo.start:0;
  const sample=espressoSample(active?elapsed:0);
  const steaming=active&&sample.envelope>.03||this.demo?.kind==='steam';
  if(brew)this.open=false;
  this.openAmount+=(Number(this.open)-this.openAmount)*(this.reduced?1:1-Math.exp(-dt*7));
  component(this.parts.pressure_needle.rotation,2,sample.needle);
  component(this.parts.brew_lever.rotation,0,sample.lever);
  component(this.parts.steam_valve.rotation,2,steaming?Math.max(.35,sample.valve):0);
  component(this.parts.steam_wand.rotation,1,steaming?-.13:0);
  for(const side of ['left','right']){
   const b=this.parts['brew_button_'+side];component(b.position,2,this.base['brew_button_'+side].p[2]+sample.button);
   const flow=this.parts['coffee_stream_'+side];flow.visible=!!active&&sample.flow>.015;component(flow.scale,1,sample.flow);
   component(this.parts['portafilter_'+side].rotation,1,this.openAmount*(side==='left'?-.25:.25));
  }
  component(this.parts.tank_lid.rotation,0,-1.02*this.openAmount);
  component(this.parts.drip_tray.position,2,this.base.drip_tray.p[2]+.25*this.openAmount);
  // Existing materials keep their paint. Only the small status lens changes light.
  descendants(this.parts.status_light,n=>{if(n.mesh)n.unlit=!!active||!!steaming;if(n.material){n.material.emissive?.setRGB(.18,.10,.025);n.material.emissiveIntensity=active?.5:0;}});
  for(let i=0;i<5;i++){
   const name='steam_puff_'+i,n=this.parts[name],p=this.base[name].p;
   n.visible=!!steaming&&!this.reduced;
   const phase=(time*.85+i*.195)%1,scale=.40+phase*1.0;
   write(n.position,[p[0]+Math.sin(phase*4+i)*.032,p[1]+phase*.19,p[2]+Math.sin(time*.75+i)*.025]);
   write(n.scale,[scale,scale,scale]);
   descendants(n,c=>{if(c.mesh)c.tint[3]=.35*(1-phase);if(c.material)c.material.opacity=.35*(1-phase);});
  }
  this.state={active:!!active,steaming:!!steaming,elapsed,needle:sample.needle,flow:sample.flow,open:this.open,openAmount:this.openAmount};
 }
 snapshot(){return {...this.state,visibleStreams:['left','right'].filter(s=>this.parts['coffee_stream_'+s].visible).length};}
 dispose(){for(let i=0;i<5;i++)descendants(this.parts['steam_puff_'+i],n=>{n.material?.dispose();});descendants(this.parts.status_light,n=>n.material?.dispose());}
}

export { ESPRESSO_DURATION, ESPRESSO_PARTS, espressoSample, EspressoMotion };
