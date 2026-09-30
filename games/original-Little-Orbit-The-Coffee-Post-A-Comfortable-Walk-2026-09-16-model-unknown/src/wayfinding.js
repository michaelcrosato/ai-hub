import { normalAt, frameAt, framePoint, coordinates } from './physics.js';
import { norm, vmul, vadd, dot, clamp, projectTangent, cross } from './math.js';
/** Signs and route anchors use the same frames as the stairs and their floors. */
function addWayfinding(w){
 const m=frameAt(13,9),pt=(x,y,z)=>norm(framePoint(m,[x,y,z]));
 w.libraryAccess=[[-3,7.7],[7.3,7.7]].map(([x,z],i)=>({approach:normalAt(...(i?[22,18.3]:[8,19])),entry:pt(x,Math.sqrt(26*26-x*x-(z+.45)**2)-26,z+.45),top:pt(x,3.35,1.5)}));
 for(const a of w.libraryAccess)w.path([coordinates(a.approach),coordinates(a.entry)],1.9,'#ead9b0',.09);
 const lib=w.rootAt([13,9]);lib.name='library_edge_guards';
 const guard=(a,b)=>{w.rod(lib,a,b,.05,'#aa7955');w.surfaces.rail(lib.matrix,a,b,'library_guard');const steps=Math.max(1,Math.ceil(Math.hypot(...a.map((x,i)=>x-b[i]))/.9));for(let i=0;i<=steps;i++){const p=a.map((x,k)=>x+(b[k]-x)*i/steps);w.rod(lib,[p[0],p[1]-.78,p[2]],p,.035,'#aa7955');}};
 const y=4.15;
 // Leave clear openings at both stairs and at each end of the bridge.
 for(const [a,b]of [
  [[-5.35,y,1.72],[-4.14,y,1.72]],[[-1.86,y,1.72],[-.58,y,1.72]],
  [[-.58,y,-3.02],[-.58,y,-1.61]],[[-.58,y,.22],[-.58,y,1.72]],
  [[5.72,y,1.72],[6.15,y,1.72]],[[8.45,y,1.72],[8.94,y,1.72]],
  [[8.94,y,-2.98],[8.94,y,1.72]],[[5.72,y,-2.98],[5.72,y,-1.61]],[[5.72,y,.22],[5.72,y,1.72]]
 ])guard(a,b);
 const board=(at,text,heading=0)=>{
  const g=w.rootAt(at,heading);g.name='route_sign_'+text.replace(/\W+/g,'_');
  w.prefab(g,'sign',[0,0,0],1.06);w.sign(g,[0,1.75,.09],text,2.06,.56);
  w.sign(g,[0,1.75,-.13],text,2.06,.56,Math.PI);
  w.solid(g,[0,.69,0],[.16,1.38,.16],'sign_post');
 };
 board([2.3,6.4],'SQUARE · LIBRARY',.12);
 board([-5.45,14.65],'PIP\nBUTTON SQUARE',-.4);
 board(coordinates(pt(-4.65,0,8.35)),'MISO\nLIBRARY STAIRS');
 board(coordinates(pt(8.95,0,8.35)),'LIBRARY\nSTAIRS & BRIDGE');
 board([30.6,10],'ORCHARD\nFOLLOW THE PATH',.3);
 board([-44.5,9.1],'PEBBLE\nLILY POND',-.5);
 board([5.9,-4.1],'SUNROOM\nCREAM PATH',Math.PI);
 // The café entrance has a continuous support surface under its three treads.
 w.surfaces.ramp(w.cafe.matrix,0,4.16,3.08,4.16,Math.sqrt(26*26-4.16**2)-26,.145);
}
const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
const setHidden=(el,hidden)=>{if(el.hidden!==hidden)el.hidden=hidden;};
class Journey{
 constructor(){this.stair=null;this.last='';this.distance=0;this.el=null;}
 target(state,world,tracked){
  if(tracked)return {...tracked,h:tracked.h||0,kind:tracked.kind||'explore'};
  if(state.complete)return null;
  if(!state.coffees)return {...world.interactions.find(o=>o.type==='machine'),kind:'brew'};
  return {...world.pets.find(p=>!state.served.has(p.id)),kind:'delivery'};
 }
 update(state,world,player,forward,input,tracked,mode,brew,ui){
  const el=this.el||(this.el={card:document.getElementById('route-guide'),title:document.getElementById('route-destination'),hint:document.getElementById('route-instruction'),arrow:document.getElementById('route-arrow'),on:document.getElementById('onboarding'),onText:document.getElementById('onboarding-text')});
  const t=this.target(state,world,tracked),music=document.body.classList.contains('music-view');
  setHidden(el.card,mode!=='play'||ui.modal||ui.journalOpen||music);
  const use=input.isTouch?'Tap Use':input.isPad?'Press X':'Press E';
  if(!t){setText(el.title,'Round complete · 4 of 4 delivered');setText(el.hint,'Open the journal to choose another walk.');setText(el.arrow,'✓');if(el.arrow.style.transform)el.arrow.style.transform='';}
  else {
   let n=t.n||normalAt(...t.at),h=t.h||0,detail=t.kind==='brew'?(input.isTouch?'Tap Brew. Wait for the cups.':use+' at the machine. Wait for the cups.'):t.kind==='delivery'?'Follow the path. Stop near '+t.name+'.':t.hint||'Use the journal for the route and the activity.';
   if(t.id==='miso'&&player.h<h-1.15){
    if(!this.stair||this.last!==t.id)this.stair={...world.libraryAccess.reduce((a,b)=>dot(a.entry,player.n)>dot(b.entry,player.n)?a:b),up:false,approached:false};
    if(Math.acos(clamp(dot(this.stair.entry,player.n),-1,1))*26<1.1)this.stair.up=true;
    if(Math.acos(clamp(dot(this.stair.approach,player.n),-1,1))*26<1.1)this.stair.approached=true;
    n=this.stair.up?this.stair.top:this.stair.approached?this.stair.entry:this.stair.approach;detail=this.stair.up?'Walk up the stairs. No jump is needed.':'Follow the Miso sign to the library stairs.';
   }else this.stair=null;
   const d=Math.acos(clamp(dot(n,player.n),-1,1))*26,dir=projectTangent(n,player.n),r=norm(cross(forward,player.n));
   setText(el.title,(t.kind==='brew'?'1 · Coffee machine':t.kind==='delivery'?'Next · '+t.name+' · '+t.place:t.name)+' · '+Math.round(d)+' m');
   setText(el.hint,brew?'Coffee is brewing. Stay by the machine.':detail);
   setText(el.arrow,'↑');const turn=`rotate(${Math.atan2(dot(dir,r),dot(dir,forward)).toFixed(2)}rad)`;if(el.arrow.style.transform!==turn)el.arrow.style.transform=turn;this.last=t.id;
  }
  setHidden(el.on,state.onboarded||state.coffees>0||state.complete||mode!=='play'||ui.modal||ui.journalOpen||!!brew||!!tracked||music);
  setText(el.onText,input.isTouch?'Left side: move. Drag the view: look. Pinch: zoom. Tap Use near an object.':input.isPad?'Left stick: move. Right stick: look. X: use. A: hop. Hold B: run. RB / LB: zoom.':'WASD: move. Drag: look. E: use. B: centre the camera. Your coffee stays warm.');
 }
}
export { addWayfinding, Journey };
