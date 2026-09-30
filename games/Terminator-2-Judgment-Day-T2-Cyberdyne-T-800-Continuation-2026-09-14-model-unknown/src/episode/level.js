import { defaultMotor } from '../core/motor.js';
import { createPrefabs } from '../level/prefabs.js';
import { VEHICLES } from './rules.js';
const box = (position,scale,color,extra={}) => ({shape:'box',position,scale,color,...extra});
export function registerYardArt(prefabs) {
  prefabs.register({id:'patrol',name:'Police cruiser',group:'Cyberdyne',summary:'An unoccupied vehicle. Disable it to clear the route.',components:[],build:()=>({body:'fixed',visuals:[box([0,.7,0],[2.1,.75,4.9],'#101820'),box([0,1.26,.05],[1.86,.65,2.65],'#92a9b9')],colliders:[{position:[0,.68,0],size:[2.18,1.05,5.1]},{position:[0,1.35,.04],size:[1.94,.8,2.7]}]})});
  prefabs.register({id:'officer',name:'Police officer',group:'Cyberdyne',summary:'Protected person. Fire is blocked when this person is in the line of fire.',components:[],build:()=>({body:'kinematic',visuals:[box([0,1,0],[.52,.7,.32],'#182333')],colliders:[{position:[0,.88,0],size:[.65,1.76,.52]}]})});
  prefabs.register({id:'exit-panel',name:'Support station',group:'Cyberdyne',summary:'Repair integrity and reload the minigun.',components:[{type:'board-car'}],build:()=>({body:'fixed',visuals:[box([0,1.2,0],[.8,1.6,.25],'#182f36'),box([0,1.65,-.15],[.62,.25,.05],'#5dddbd',{emissive:1.4})],colliders:[{position:[0,1.2,0],size:[.9,1.8,.4]}]})});
}
export function yardLevel(config={}) {
  const prefabs=createPrefabs();registerYardArt(prefabs);const entities=[];
  const add=(type,id,p,scale=[1,1,1],color,yaw=0)=>{const e=prefabs.create(type,p,id);e.scale=scale;e.rotation=[0,yaw,0];if(color)e.color=color;entities.push(e);return e;};
  add('block','street',[0,-.35,-25],[100,.35,90],'#14202b');
  add('block','building-base',[0,0,7],[40,5.85,28],'#293c4a');
  add('block','terrace-floor',[0,5.85,5],[40,.35,22],'#607481');
  add('block','rear-wall',[0,6.2,15.7],[40,6,.5],'#172d3b');
  add('block','left-wall',[-19.8,6.2,5],[.5,5,22],'#314958');
  add('block','right-wall',[19.8,6.2,5],[.5,5,22],'#314958');
  add('block','parapet',[0,6.2,-5.85],[40,.64,.28],'#56707e');
  add('block','left-rail',[-19.3,6.2,-3],[.3,.85,6],'#3c5262');
  add('block','right-rail',[19.3,6.2,-3],[.3,.85,6],'#3c5262');
  // A wide opening links the lab to the terrace. The wing windows remain solid.
  add('block','lab-window-left',[-12.5,6.2,3.6],[14,3.6,.18],'#183c50');
  add('block','lab-window-right',[12.5,6.2,3.6],[14,3.6,.18],'#183c50');
  add('block','lab-door-header',[0,9.8,3.6],[40,.4,.55],'#5b7481');
  add('block','lab-roof',[0,10.2,10],[40,.3,12.3],'#314350');
  for(const x of [-18,-6,6,18])add('block',`column-${x}`,[x,6.2,3.6],[.45,4,.55],'#607785');
  for(const x of [-13,13]){
    add('block',`cover-${x}`,[x,6.2,-2.8],[4,.85,1.1],'#617783');
    add('block',`lab-desk-${x}`,[x,6.2,9.5],[6,.85,1.8],'#263e4c');
  }
  add('exit-panel','escape-car',[0,6.2,14.95]);
  add('spawn','start',[0,6.25,6.5]);
  for(const v of VEHICLES){
    add('patrol',v.id,v.position,[1,1,1],undefined,v.yaw);
    for(let j=0;j<2;j++){
      const x=v.position[0]+(j?2.3:-2.3),z=v.position[2]-1.8;
      add('officer',`officer-${v.label}-${j}`,[x,0,z],[1,1,1],undefined,j?25:-25);
    }
  }
  for(const [i,x] of [-30,-15,0,15,30].entries())add('block',`road-barrier-${i}`,[x,0,-43],[5,.8,.65],'#626d70');
  // Street blocks also stop a falling player from leaving the world.
  add('block','street-back',[0,0,-62],[100,4,.6],'#142735');
  return {version:1,name:config.title??'Cyberdyne / Zero casualties',description:'A first-person fan scene. Disable the police vehicles and continue through response waves.',objective:config.objective??'Disable the opening police line. Continue through response waves. Tab: T-800 vision.',seed:config.seed??1991,
    environment:{sky:'#071421',fog:.006,sun:.55,exposure:1.05,...config.environment},
    player:{...defaultMotor,walkSpeed:3.8,sprintSpeed:5.8,crouchSpeed:2.2,headBob:.15,fov:76,...config.player},entities};
}
