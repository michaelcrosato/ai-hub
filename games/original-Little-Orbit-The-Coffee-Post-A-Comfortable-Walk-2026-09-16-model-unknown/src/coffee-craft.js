import { clamp } from './math.js';
const COFFEE_STAGES=['Grind','Press','Pour','Foam','Pack'];
function craftSample(seconds){const t=clamp(Number.isFinite(seconds)?seconds:0,0,4.2);const stage=t<.58?0:t<1.03?1:t<2.95?2:t<3.60?3:4;return {stage,label:COFFEE_STAGES[stage],progress:t/4.2,packed:stage===4?Math.min(4,1+Math.floor((t-3.60)/.15)):0};}
/** Small tools and effects supplement the authored espresso BrewCycle. */
class CoffeeCraft{
 constructor(machine,assets,audio){
  this.audio=audio;this.root=machine;this.grinder=assets.get('coffee_grinder');this.grinder.position=[-1.65,.04,-.03];machine.add(this.grinder);
  this.tools=assets.get('barista_tools');machine.add(this.tools);this.tamper=this.tools.find('tamper');this.pitcher=this.tools.find('milk_pour');this.finish=this.tools.find('coffee_finish');this.finish.position=[.44,.593,.556];this.tamper.position=[-1.65,.65,.34];this.pitcher.position=[1.40,.42,.76];
  this.grains=[];for(let i=0;i<10;i++){const n=machine.part('smooth','#69503a',[-1.65,.7,.34],[.012,.021,.012]);n.name='coffee_ground_'+i;this.grains.push(n);}
  this.milk=machine.part('cylinder','#f9ebcb',[.44,.76,.556],[.012,.27,.012]);this.milk.name='milk_stream';this.milk.visible=false;
  this.hearts=[];for(let s of [-1,1]){const n=machine.part('smooth','#f4dfb3',[.44+s*.026,.596,.54],[.034,.002,.052],[0,s*.40,0]);n.name='latte_heart_'+s;this.hearts.push(n);}
  this.state={active:false,stage:0,packed:0};
 }
 update(time,brew,machineState){const active=!!brew||machineState.active,t=brew?time-brew.start:machineState.elapsed,s=craftSample(t);this.state={active,...s};const stage=active?s.stage:-1;
  if(active)this.audio.brewStep(stage);
  this.grinder.find('wheel').rotation[2]=stage===0?time*13:0;
  const basket=this.grinder.find('basket');basket.visible=stage<=1;
  this.tamper.visible=stage===1;this.tamper.position=[-1.65,.72-Math.sin(clamp((t-.58)/.45,0,1)*Math.PI)*.19,.34];
  this.grains.forEach((n,i)=>{n.visible=stage===0;n.position[1]=.49+(1-(t*5+i*.13)%1)*.40;});
  this.pitcher.visible=stage===3;const p=clamp((t-2.95)/.65,0,1);this.pitcher.position=[.67,.83,.556];this.pitcher.rotation[2]=stage===3?-.65*Math.sin(p*Math.PI):0;
  this.finish.visible=stage>=3||!active;this.milk.visible=stage===3&&p>.1&&p<.9;for(const n of this.hearts)n.visible=!active||stage>=3&&p>.4;
 }
 snapshot(){return {...this.state,grains:this.grains.filter(n=>n.visible).length,milk:this.milk.visible};}
}

export { COFFEE_STAGES, craftSample, CoffeeCraft };
