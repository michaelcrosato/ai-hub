import { DETOURS, GLAZES } from './detour-spec.js';
/** Persistent exploration only. This class has no reference to delivery state. */
class DetourState {
 constructor(){this.memories=new Set();this.glaze=0;this.stones=0;this.track='';}
 get count(){return this.memories.size;}
 use(id){
  const item=DETOURS.find(x=>x.id===id);if(!item)return {ok:false};
  const first=!this.memories.has(id);
  if(id==='glaze')this.glaze=(this.glaze+1)%GLAZES.length;
  if(id==='cairn')this.stones=Math.min(3,this.stones+1);
  const complete=id!=='cairn'||this.stones===3;if(complete)this.memories.add(id);
  const words={
   postcard:['Letter & Lantern','A fern, a moon, and a small hello. Your new postcard is on the shop display.'],
   orrery:['Turn & Tinker','One turn for the planet. Two for the moon. It needs no batteries and no coffee.'],
   greenhouse:['Fernlight Glasshouse','Water runs into the beds. The seed pods open. This garden will stay green between rounds.'],
   leafboat:['The upper baths','A leaf makes one slow lap of the pool. The rear stairs lead toward the stone crossing.'],
   glaze:['The drying loft','Your tile is on the wall. Press E again to choose another color. The cup you made downstairs is unchanged.'],
   fernprint:['The fern room','A leaf becomes a page. Your print stays in the open book. Take the rear stairs into the woodland.'],
   shadowplay:['A very small theatre','The moon rises. The bird follows it. Downstairs, the cinema has three more stories.'],
   cairn:['Tumbledown Crossing',this.stones===3?'Three stones, standing together. The stream takes the long way under the bridge.':`${this.stones} of 3 stones. Press E to balance the next one.`]
  };
  return {ok:true,id,title:words[id][0],text:words[id][1],fresh:first&&complete,voice:item.voice};
 }
 snapshot(){return {memories:[...this.memories],glaze:this.glaze,stones:this.stones,track:this.track};}
 restore(data){
  if(!data||typeof data!=='object')return;
  this.memories=new Set((Array.isArray(data.memories)?data.memories:[]).filter(id=>DETOURS.some(x=>x.id===id)));
  this.glaze=Number.isInteger(data.glaze)&&data.glaze>=0&&data.glaze<GLAZES.length?data.glaze:0;
  this.stones=Number.isInteger(data.stones)?Math.max(0,Math.min(3,data.stones)):0;
  if(this.memories.has('cairn'))this.stones=3;
  if(this.stones===3)this.memories.add('cairn');
  this.track=DETOURS.some(x=>x.id===data.track)?data.track:'';
 }
}

export { DetourState };
