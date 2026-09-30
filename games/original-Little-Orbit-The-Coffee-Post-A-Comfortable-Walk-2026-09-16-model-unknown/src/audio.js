import { VOICES } from './life-spec.js';
/** Original score and sound files next to the game, plus local sound synthesis.
 * Each voice has a different pitch, rhythm, and tone. Dialogue stays captioned.
 * Nothing is fetched or decoded until the player turns the sound on.
 */
const SOUNDS=['bell','complete','cup','delivery','discovery','grind','jump','land','paper','pour','steam','step_path','step_wood','swell','ui','water','trailer'];
const PREFS='little-orbit-audio-v1';
class AudioGarden{
 constructor(){
  this.enabled=false;this.paused=false;this.ctx=null;this.master=null;this.sources=new Set();
  this.lastBird=0;this.lastFilm=-1;this.lastBrew=-1;this.buffers=new Map();this.loading=null;this.loop=null;
  this.musicVolume=.38;this.fxVolume=.78;this.duckUntil=0;this.musicMode='walk';this.lastMusicGain=-1;this.foot=0;
  this.status='Sound is off';this.playCounts={};
  // Remember whether the player wanted sound, so the next visit can turn it back on at the first tap or key.
  this.wanted=false;
  try{const s=JSON.parse(localStorage.getItem(PREFS)||'null');if(s){this.musicVolume=Math.max(0,Math.min(1,Number(s.music)||0));this.fxVolume=Math.max(0,Math.min(1,Number(s.effects)||0));this.wanted=s.on===true;}}catch{}
 }
 start(){
  try{
   this.ctx ||= new (window.AudioContext||window.webkitAudioContext)();
   if(!this.master){
    this.master=this.ctx.createGain();this.master.gain.value=this.enabled?.78:0;
    this.musicBus=this.ctx.createGain();this.fxBus=this.ctx.createGain();this.musicBus.gain.value=this.musicVolume;this.fxBus.gain.value=this.fxVolume;
    const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-9;limiter.knee.value=9;limiter.ratio.value=4;limiter.attack.value=.005;limiter.release.value=.20;
    this.musicBus.connect(limiter);this.fxBus.connect(limiter);limiter.connect(this.master);this.master.connect(this.ctx.destination);
   }
   if(this.enabled){clearTimeout(this.suspendTimer);if(!this.paused)this.ctx.resume().catch(()=>{this.status='Tap Sound again to start audio.';});this.master.gain.setTargetAtTime(.78,this.ctx.currentTime,.025);this.load();}
   return true;
  }catch{this.status='Audio is not available in this browser.';this.enabled=false;return false;}
 }
 load(){
  if(this.loading)return this.loading;
  if(!this.ctx){this.status='Audio is not available in this browser.';return Promise.resolve();}
  this.status='Loading original music';
  const get=async id=>{
   const r=await fetch(new URL(`../audio/${id}.mp3`,import.meta.url));if(!r.ok)throw new Error('Missing sound: '+id);
   this.buffers.set(id,await this.ctx.decodeAudioData(await r.arrayBuffer()));
  };
  this.loading=(async()=>{
   // The score first, so the walk has music while the small effects decode.
   try{await get('music');this.startMusic();}catch{this.status='The music could not load. Sound effects remain available.';}
   await Promise.allSettled(SOUNDS.map(get));
   if(this.buffers.has('music'))this.status='Morning Route · original score';
  })();
  return this.loading;
 }
 savePrefs(){try{localStorage.setItem(PREFS,JSON.stringify({music:this.musicVolume,effects:this.fxVolume,on:this.wanted}));}catch{}}
 startMusic(){
  if(this.loop||!this.ctx||!this.buffers.has('music')||!this.enabled)return;
  const o=this.ctx.createBufferSource();o.buffer=this.buffers.get('music');o.loop=true;o.loopStart=0;o.loopEnd=Math.min(48,o.buffer.duration);o.connect(this.musicBus);o.start();this.loop=o;
 }
 stop(group=null,preserve=null){for(const s of [...this.sources])if((!group||s.group===group)&&s.group!==preserve){try{s.node.stop();}catch{}this.sources.delete(s);}}
 toggle(persist=true){
  this.enabled=!this.enabled;if(persist){this.wanted=this.enabled;this.savePrefs();}
  if(this.enabled){if(!this.start())this.enabled=false;else{this.startMusic();if(this.buffers.has('music'))this.status='Morning Route · original score';}}
  else{this.stop();if(this.ctx&&this.master){this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.018);this.suspendTimer=setTimeout(()=>{if(!this.enabled)this.ctx.suspend().catch(()=>{});},100);}this.status='Sound is off';}
  return this.enabled;
 }
 pause(yes){
  yes=!!yes;if(yes===this.paused)return;this.paused=yes;
  if(yes){this.stop(null,'trailer');this.ctx?.suspend().catch(()=>{});}else if(this.enabled){this.ctx?.resume().catch(()=>{});this.startMusic();}
 }
 volumes(music,effects){
  this.musicVolume=Math.max(0,Math.min(1,music));this.fxVolume=Math.max(0,Math.min(1,effects));this.lastMusicGain=-1;
  if(this.ctx)this.fxBus.gain.setTargetAtTime(this.fxVolume,this.ctx.currentTime,.035);
  this.savePrefs();
  this.scene(this.musicMode);
 }
 scene(mode='walk'){
  this.musicMode=mode;if(!this.ctx||!this.musicBus)return;
  const duck=mode==='trailer'?0:mode==='complete'?.45:(mode==='cinema'||mode==='instrument')?.14:this.ctx.currentTime<this.duckUntil?.36:1;
  const level=this.musicVolume*duck;if(level!==this.lastMusicGain){this.lastMusicGain=level;this.musicBus.gain.setTargetAtTime(level,this.ctx.currentTime,.18);}
 }
 fx(id,volume=.22,pan=0,rate=1,delay=0,group='fx'){
  if(!this.enabled||this.paused||!this.ctx||this.sources.size>=28)return false;const buffer=this.buffers.get(id);if(!buffer)return false;
  const o=this.ctx.createBufferSource(),gain=this.ctx.createGain(),stereo=this.ctx.createStereoPanner();o.buffer=buffer;o.playbackRate.value=rate;gain.gain.value=Math.max(0,Math.min(.8,volume));stereo.pan.value=Math.max(-1,Math.min(1,pan));
  o.connect(gain);gain.connect(stereo);stereo.connect(this.fxBus);const s={node:o,group};this.sources.add(s);this.playCounts[id]=(this.playCounts[id]||0)+1;
  o.onended=()=>{o.disconnect();gain.disconnect();stereo.disconnect();this.sources.delete(s);};o.start(this.ctx.currentTime+Math.max(0,delay));return true;
 }
 footstep(wood=false,running=false){this.foot++;this.fx(wood?'step_wood':'step_path',running?.20:.135,(this.foot%2?-.14:.14),[.96,1.04,1,.99][this.foot%4]);}
 note(frequency=440,duration=.2,volume=.035,type='sine',delay=0,group='tone',end=null){
  if(!this.enabled||this.paused||!this.ctx||!Number.isFinite(frequency))return;
  if(this.sources.size>=32)return;const t=this.ctx.currentTime+Math.max(0,delay),o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(45,frequency),t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(45,end),t+duration);g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(Math.min(.10,volume),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(.025,duration));o.connect(g);g.connect(this.fxBus);const s={node:o,group};this.sources.add(s);o.onended=()=>{o.disconnect();g.disconnect();this.sources.delete(s);};o.start(t);o.stop(t+duration+.03);
 }
 noise(duration=.3,volume=.012,cutoff=800,delay=0,group='fx'){
  if(!this.enabled||this.paused||!this.ctx||this.sources.size>=30)return;const len=Math.floor(this.ctx.sampleRate*duration),b=this.ctx.createBuffer(1,len,this.ctx.sampleRate),data=b.getChannelData(0);let seed=291;for(let i=0;i<len;i++){seed=(seed*16807)%2147483647;data[i]=(seed/1073741824-1)*(1-i/len);}
  const o=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain(),t=this.ctx.currentTime+delay;filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);o.buffer=b;o.connect(filter);filter.connect(gain);gain.connect(this.fxBus);const s={node:o,group};this.sources.add(s);o.onended=()=>{o.disconnect();filter.disconnect();gain.disconnect();this.sources.delete(s);};o.start(t);o.stop(t+duration+.01);
 }
 voice(id){const v=VOICES[id]||VOICES.miso;if(this.ctx)this.duckUntil=this.ctx.currentTime+v.shape.length*v.pace+.5;this.stop('voice');v.shape.forEach((ratio,i)=>{this.note(v.base*ratio,v.pace*.9,.030,v.type,i*v.pace,'voice',v.base*ratio*.89);if(id==='pebble')this.note(v.base*ratio*2,v.pace*.6,.006,'sine',i*v.pace,'voice');});return v.label;}
 instrument(kind,index,delay=0){const f=[261.63,293.66,329.63,392,440][index];if(kind==='glass'){this.note(f*2,.85,.038,'sine',delay);this.note(f*4.01,.3,.010,'sine',delay);}else{this.note(f,.45,.060,'triangle',delay);this.note(f*3.98,.10,.013,'sine',delay);}}
 bird(delay=0,volume=.025){[1175,1568,1319,1760].forEach((f,i)=>this.note(f,.12,volume,'sine',delay+i*.16,'bird',f*1.18));}
 chime(){if(this.fx('discovery',.20))return;[523.25,659.25,783.99].forEach((f,i)=>this.note(f,.55,.023,'sine',i*.09));}
 hello(){this.note(440,.12,.025);this.note(587,.25,.02,'sine',.1);}
 tap(){if(!this.fx('ui',.15))this.note(190,.07,.008,'triangle');}
 brew(){this.lastBrew=-1;}
 brewStep(stage){if(stage===this.lastBrew)return;this.lastBrew=stage;
  const cues=['grind','cup','pour','steam','cup'];
  if(!this.fx(cues[stage]||'cup',stage===2?.30:.26,stage===3?.2:-.1,1,0,'brew'))this.noise(.24,.016,900,0,'brew');
  if(stage===4)for(let i=1;i<4;i++)this.fx('cup',.18,(i-1.5)*.12,1+i*.035,i*.13,'brew');
 }

 film(id,t){const beat=Math.floor(t/.8);if(beat===this.lastFilm)return;this.lastFilm=beat;const seq=id==='rain'?[0,2,1,3,2,4,3,1]:[0,0,2,3,4,3,2,1];this.instrument(id==='rain'?'glass':'wood',seq[beat%seq.length]);}
 bell(){if(this.fx('bell',.25))return;[523,1047,1568].forEach((f,i)=>this.note(f,1.5,.028/(i+1),'sine'));}
 ambience(t){this.lastBird=t;/* Positional birds are controlled by LifeMotion. */}
 snapshot(){return {enabled:this.enabled,paused:this.paused,context:this.ctx?.state||'none',activeSources:this.sources.size,musicSources:this.loop?1:0,decodedBuffers:this.buffers.size,musicSeconds:this.buffers.get('music')?.duration||0,musicVolume:this.musicVolume,effectsVolume:this.fxVolume,status:this.status,played:{...this.playCounts},voices:Object.keys(VOICES).length};}

}

export { AudioGarden };
