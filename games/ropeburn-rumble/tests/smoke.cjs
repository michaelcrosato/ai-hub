const fs=require('fs'), vm=require('vm');
class ClassList{constructor(){this.s=new Set()}toggle(k,v){if(v===undefined)v=!this.s.has(k);v?this.s.add(k):this.s.delete(k)}add(k){this.s.add(k)}remove(k){this.s.delete(k)}contains(k){return this.s.has(k)}}
class El{
  constructor(id=''){this.id=id;this.classList=new ClassList();this.style={};this.events={};this.children=[];this._buttons=[];this.dataset={};this._innerHTML='';this.textContent='';}
  addEventListener(n,f){(this.events[n]??=[]).push(f)}
  dispatch(n,e={}){for(const f of this.events[n]||[])f({preventDefault(){},pointerId:1,clientX:0,clientY:0,...e})}
  setPointerCapture(){} remove(){} appendChild(e){this.children.push(e);return e} getBoundingClientRect(){return {left:0,top:0,width:160,height:160}}
  querySelector(sel){return new El(this.id+sel)}
  querySelectorAll(sel){return sel==='button'?this._buttons:[]}
  set innerHTML(v){this._innerHTML=v;this._buttons=[];for(const m of v.matchAll(/<button[^>]*(data-(boost|gear)=\"([^\"]+)\")[^>]*>/g)){const b=new El('button');b.dataset[m[2]]=m[3];this._buttons.push(b)}} get innerHTML(){return this._innerHTML}
}
const els=new Map();
const getEl=(sel)=>{const id=sel.replace(/^#/,'');if(!els.has(id))els.set(id,new El(id));return els.get(id)};
const canvasCtx={fillStyle:'',fillRect(){}};
const document={querySelector:getEl,createElement(tag){const e=new El(tag);if(tag==='canvas'){e.getContext=(k)=>k==='2d'?canvasCtx:null;e.width=0;e.height=0;}return e;}};
let seed=123456789;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
const storage={};
const sandbox={console,document,localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=String(v)},navigator:{vibrate(){}},location:{search:'?legacy=1'},URLSearchParams,structuredClone,performance:{now:(()=>{let t=0;return()=>t+=16})()},Math:Object.assign(Object.create(Math),{random:rnd}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:(fn)=>{fn();return 1},clearTimeout(){},innerWidth:412,innerHeight:915,devicePixelRatio:2,matchMedia:()=>({matches:true}),addEventListener(){},window:null};
sandbox.window=sandbox;
vm.createContext(sandbox);
let src=fs.readFileSync(require('path').join(__dirname,'..','game.js'),'utf8');
src += `\n;globalThis.__debug={state,update,playerPunch,dodge,duck,specialRush,resetBout,beginFight,finishBout,ui,mods,meta,openLab,renderLab};`;
vm.runInContext(src,sandbox,{filename:'game.js'});
const d=sandbox.__debug;

function tapGetUp(){for(let i=0;i<8 && d.state.mode==='playerDown';i++)d.ui.getupBtn.dispatch('pointerdown')}
function runBot(profile){
  d.resetBout();d.beginFight();
  let lastMode='', plan=null,recoverHandled=false,steps=0;
  while(d.state.mode!=='result' && steps++<12000){
    const f=d.state.foe;
    if(d.state.mode==='playerDown'){tapGetUp();continue}
    if(d.state.mode==='corner'){const b=d.ui.cornerChoices.querySelectorAll('button')[0];if(!b)throw new Error('Corner choice button not wired');b.dispatch('click');continue;}
    if(d.state.mode!=='fight'){d.update(.05);continue}
    if(f.mode!==lastMode){
      recoverHandled=false;
      if(f.mode==='tell'){
        const q=rnd(); plan=q<profile.counter?'counter':q<profile.counter+profile.dodge?'dodge':q<profile.counter+profile.dodge+profile.guard?'guard':'eat';
      } else plan=null;
      lastMode=f.mode;
    }
    if(f.mode==='tell'){
      if(plan==='counter'&&f.t<Math.max(.20,f.attack.tell*.48)&&d.state.actionCd<=0){d.playerPunch(rnd()<.5?-1:1,false);plan='done'}
      if(plan==='dodge'&&f.t<.22&&d.state.dodgeT<=0){d.dodge(rnd()<.5?-1:1);plan='done'}
      d.state.guard=plan==='guard';
    } else d.state.guard=false;
    if(f.mode==='recover'&&!recoverHandled&&d.state.actionCd<=0&&rnd()<profile.punish){d.playerPunch(rnd()<.5?-1:1,rnd()<.18);recoverHandled=true}
    if(d.state.rush>=100&&d.state.actionCd<=0&&rnd()<profile.rush)d.specialRush();
    d.update(.05);
  }
  return {mode:d.state.mode,round:d.state.round,playerHp:+d.state.playerHp.toFixed(1),foeHp:+d.state.foeHp.toFixed(1),playerKD:d.state.playerKD,foeKD:d.state.foeKD,landed:d.state.landed,counters:d.state.counters,dodges:d.state.dodges,score:d.state.score,lastWin:d.state.lastWin};
}
const profiles={
  spam:{counter:.01,dodge:.02,guard:.05,punish:.08,rush:.5},
  novice:{counter:.12,dodge:.28,guard:.25,punish:.48,rush:.68},
  competent:{counter:.24,dodge:.43,guard:.22,punish:.70,rush:.82}
};
for(const [name,p] of Object.entries(profiles)){
  let wins=0, rounds=0,pk=0,fk=0, counters=0,dodges=0;
  for(let i=0;i<120;i++){
    seed=(123456789+i*9973)>>>0;
    Object.assign(d.meta,{xp:0,level:1,credits:0,wins:0,gear:{gloves:'balanced',boots:'quick',guard:'classic'},owned:['balanced','quick','classic']});
    const r=runBot(p);wins += r.lastWin?1:0;rounds+=r.round;pk+=r.playerKD;fk+=r.foeKD;counters+=r.counters;dodges+=r.dodges;
  }
  console.log(name,JSON.stringify({winRate:+(wins/120).toFixed(3),avgRound:+(rounds/120).toFixed(2),playerKD:+(pk/120).toFixed(2),foeKD:+(fk/120).toFixed(2),counters:+(counters/120).toFixed(2),dodges:+(dodges/120).toFixed(2)}));
}

function assert(cond,msg){if(!cond)throw new Error('ASSERT: '+msg)}
// Input and progression smoke checks.
Object.assign(d.meta,{xp:0,level:1,credits:200,wins:0,gear:{gloves:'balanced',boots:'quick',guard:'classic'},owned:['balanced','quick','classic']});
d.resetBout();d.beginFight();d.state.guard=true;d.playerPunch(-1,false);assert(d.state.guard===false,'punch must release guard');
const z0=d.state.cameraZoom;d.ui.stage.dispatch('pointerdown',{pointerId:11,clientX:100,clientY:100});d.ui.stage.dispatch('pointerdown',{pointerId:12,clientX:200,clientY:100});d.ui.stage.dispatch('pointermove',{pointerId:12,clientX:260,clientY:100});assert(d.state.cameraZoom!==z0,'pinch must change camera zoom');d.ui.stage.dispatch('pointerup',{pointerId:11});d.ui.stage.dispatch('pointerup',{pointerId:12});
d.openLab();const gearButtons=d.ui.labItems.querySelectorAll('button');const hammer=gearButtons.find(b=>b.dataset.gear==='hammers');assert(hammer,'gear shop must render hammers');hammer.dispatch('click');assert(d.meta.gear.gloves==='hammers','gear purchase must equip item');assert(d.meta.credits===80,'gear purchase must charge credits');
console.log('assertions',JSON.stringify({guardRelease:true,pinchZoom:true,gearPurchase:true}));
