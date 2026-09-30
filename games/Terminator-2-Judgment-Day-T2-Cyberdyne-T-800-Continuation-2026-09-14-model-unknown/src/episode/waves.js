import { VEHICLES } from './rules.js';
/** Finite populations with no final wave. All counters advance on the fixed game clock. */
export const OFFICER_TYPES=Object.freeze({
  patrol:{label:'PATROL OFFICER',interval:4.2,damage:1.1,burst:1,speed:3.4,color:'#24384e'},
  tactical:{label:'TACTICAL OFFICER',interval:3.3,damage:1.5,burst:3,speed:4.2,color:'#253a3d'},
  shield:{label:'SHIELD OFFICER',interval:4.8,damage:1.6,burst:2,speed:2.6,color:'#34434b'},
  marksman:{label:'MARKSMAN',interval:6.8,damage:5.5,burst:1,speed:3.2,color:'#3e434f'},
  // New in this version: fires tear-gas canisters onto the terrace instead of rounds.
  grenadier:{label:'GAS GRENADIER',interval:8.5,damage:0,burst:1,speed:3,color:'#2f4038',gas:true}
});
/** The police helicopter joins with its searchlight from this wave on. */
export const AIR_UNIT_WAVE=3;
export function wavePlan(wave){
  if(!Number.isSafeInteger(wave)||wave<0||wave>1000000)throw new Error('Invalid wave number.');
  if(wave===0)return VEHICLES.map(v=>({...v,position:[...v.position],type:'patrol',crew:['patrol','patrol'],wave:0,strength:1}));
  const count=Math.min(8,3+wave),strength=1+Math.min(2,wave*.075);
  return Array.from({length:count},(_,i)=>{
    const base=VEHICLES[i],kind=wave>=4&&i===count-1?'armored':wave>=3&&i%3===1?'van':wave>=2&&i%2===0?'suv':i%2?'interceptor':'patrol';
    const crew=[wave>=3&&i%3===1?'shield':wave>=2?'tactical':'patrol',wave>=5&&i%3===2?'marksman':wave>=2?'tactical':'patrol'];
    // From wave 4, every fourth crew brings a gas grenadier in place of its first officer.
    if(wave>=4&&i%4===3)crew[0]='grenadier';
    if(wave>=6&&i%2===0)crew.push('shield');
    return {...base,position:[...base.position],id:`wave-${wave}-${i}`,label:`${wave}.${i+1}`,type:kind,crew,wave,strength,arrivalDelay:i*.65};
  });
}
export function cleanWaveSave(raw={}){
  const integer=(v,max,fallback=0)=>Number.isSafeInteger(v)&&v>=0?Math.min(max,v):fallback;
  const wave=integer(raw?.wave,1000000),phase=raw?.phase==='break'?'break':'active';
  return {wave,phase,openingComplete:wave>0||raw?.openingComplete===true,countdown:phase==='break'&&Number.isFinite(raw?.countdown)?Math.max(0,Math.min(15,raw.countdown)):0,
    totalDisabled:integer(raw?.totalDisabled,8000008),cleared:integer(raw?.cleared,1000000),elapsed:Number.isFinite(raw?.elapsed)?Math.max(0,Math.min(86400000,raw.elapsed)):0};
}
export class WaveDirector{
  constructor(saved={},callbacks={}){Object.assign(this,cleanWaveSave(saved));this.callbacks=callbacks;}
  step(dt,remaining){
    if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid wave time.');
    this.elapsed+=dt;
    if(this.phase==='active'&&remaining===0){
      this.openingComplete=true;this.cleared=Math.max(this.cleared,this.wave);this.phase='break';
      this.countdown=this.wave===0?12:Math.max(5,11-this.wave*.35);this.callbacks.cleared?.(this.wave);return;
    }
    if(this.phase==='break'){
      this.countdown=Math.max(0,this.countdown-dt);
      if(this.countdown===0){this.wave=Math.min(1000000,this.wave+1);this.phase='active';this.callbacks.spawn?.(wavePlan(this.wave),this.wave);}
    }
  }
  disabled(){this.totalDisabled=Math.min(8000008,this.totalDisabled+1);}
  snapshot(){return {wave:this.wave,phase:this.phase,countdown:this.countdown,openingComplete:this.openingComplete,totalDisabled:this.totalDisabled,cleared:this.cleared,elapsed:this.elapsed};}
}
