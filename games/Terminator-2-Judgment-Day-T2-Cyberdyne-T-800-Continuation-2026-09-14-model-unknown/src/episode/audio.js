/**
 * Generated engine, rotor, siren, and impact sounds. No samples or film soundtrack.
 * One instance lives for the whole page: the AudioContext starts on the first gesture and
 * survives mission restarts. The kit's pause (its settings panel) suspends it.
 */
const NOISE_CUES=new Set(['explosion','shot','impact','glass','metal','tire','launch','hiss']);
export class SceneAudio {
  constructor(){this.context=null;this.volume=.28;this.sources=[];this.time=0;this.paused=false;}
  async resume(){
    if(this.paused)return;
    if(!this.context)this.init();
    if(this.context.state==='suspended')await this.context.resume();
  }
  setPaused(paused){
    this.paused=!!paused;const c=this.context;if(!c)return;
    (paused?c.suspend():c.resume()).catch(()=>{});
  }
  init(){
    const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('Web Audio is not available.');
    const c=this.context=new C(),master=this.master=c.createGain(),compressor=c.createDynamicsCompressor();
    master.gain.value=this.volume;master.connect(compressor);compressor.threshold.value=-16;compressor.ratio.value=7;compressor.connect(c.destination);
    this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=this.noise.getChannelData(0);let prev=0;
    for(let i=0;i<data.length;i++){const w=Math.random()*2-1;prev=(prev+.06*w)/1.06;data[i]=prev*3.5;}
    const loop=(type,freq,gain)=>{const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;g.gain.value=gain;o.connect(g);g.connect(master);o.start();this.sources.push(o);return {o,g};};
    this.motor=loop('sawtooth',42,0);this.siren=loop('sine',720,0);this.siren2=loop('sine',780,0);this.rotor=loop('triangle',31,0);
    const noise=c.createBufferSource();noise.buffer=this.noise;noise.loop=true;const low=c.createBiquadFilter();low.type='lowpass';low.frequency.value=800;
    this.burstGain=c.createGain();this.burstGain.gain.value=0;noise.connect(low);low.connect(this.burstGain);this.burstGain.connect(master);noise.start();this.sources.push(noise);
  }
  /** air: 0 when Air One patrols far away, 1 when it hovers in front of the terrace. */
  update(dt,spin,firing,running,remaining,air=0){
    this.time+=running?dt:0;
    const c=this.context;if(!c||c.state!=='running')return;const now=c.currentTime;
    this.master.gain.setTargetAtTime(this.volume,now,.08);
    this.motor.g.gain.setTargetAtTime(running?spin*.09:0,now,.04);this.motor.o.frequency.setTargetAtTime(35+spin*135,now,.05);
    this.burstGain.gain.setTargetAtTime(running&&firing?.65:0,now,.018);
    const sirenGain=running&&remaining>0?.013:0;
    this.siren.g.gain.setTargetAtTime(sirenGain,now,.4);this.siren2.g.gain.setTargetAtTime(sirenGain*.5,now,.4);
    this.siren.o.frequency.setTargetAtTime(660+Math.sin(this.time*2.2)*230,now,.08);this.siren2.o.frequency.setTargetAtTime(950+Math.sin(this.time*1.7+2)*310,now,.08);
    this.rotor.g.gain.setTargetAtTime(running?.028+air*.05:0,now,.3);this.rotor.o.frequency.setTargetAtTime(28+air*6+Math.sin(this.time*.7)*3,now,.08);
  }
  cue(kind){
    const c=this.context;if(!c||c.state!=='running'||this.volume<=0)return;const now=c.currentTime;
    const g=c.createGain();g.connect(this.master);
    const duration=kind==='explosion'?1.15:kind==='hiss'?1.6:kind==='reboot'?.9:kind==='reload'||kind==='launch'?.3:kind==='spotted'?.22:.09;
    if(NOISE_CUES.has(kind)){
      const n=c.createBufferSource(),filter=c.createBiquadFilter();n.buffer=this.noise;
      filter.type=kind==='glass'||kind==='hiss'?'highpass':'lowpass';
      filter.frequency.value=kind==='explosion'?320:kind==='glass'?2800:kind==='hiss'?3600:kind==='metal'?2200:kind==='tire'?180:kind==='launch'?260:1800;
      const peak=kind==='explosion'?.9:kind==='launch'?.35:kind==='hiss'?.12:.07;
      n.connect(filter);filter.connect(g);g.gain.setValueAtTime(peak,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);n.start();n.stop(now+duration);n.onended=()=>{n.disconnect();filter.disconnect();g.disconnect();};
    }else{
      const o=c.createOscillator();o.type=kind==='reload'||kind==='spotted'?'square':kind==='reboot'?'sawtooth':'sine';
      const from=kind==='success'?780:kind==='scan'?1100:kind==='wave'?240:kind==='warning'?160:kind==='spotted'?1320:kind==='reboot'?520:300;
      const to=kind==='success'?1170:kind==='spotted'?990:kind==='reboot'?60:90;
      o.frequency.setValueAtTime(from,now);o.frequency.exponentialRampToValueAtTime(to,now+duration);
      o.connect(g);g.gain.setValueAtTime(kind==='spotted'?.03:.045,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.start();o.stop(now+duration);o.onended=()=>{o.disconnect();g.disconnect();};
    }
  }
}
