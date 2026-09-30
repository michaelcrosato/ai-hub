import { Node } from './engine.js';
import { LIFE_SITES, LIFE_PATHS } from './life-spec.js';
import { frameAt, framePoint, normalAt } from './physics.js';
import { norm, len } from './math.js';

/** Add encounter scenery. Do not change a coffee rule or block a main route. */
function addSmallLives(w){
 const actors=[],instruments=[],paths=[];
 const dyn=(at,name)=>{const g=new Node(name);g.matrix=frameAt(...at);w.dynamics.push(g);return g;};
 const label=(parent,p,text,width,height)=>{const sign=w.sign(parent,p,text,width,height);const back=sign.part('plane','#ffffff',[0,0,-.093],[width,height,1],[0,Math.PI,0]);back.texture=sign.children.find(n=>n.texture).texture;back.unlit=true;return sign;};
 const atPoint=(root,p)=>{const q=framePoint(root.matrix,p);return {n:norm(q),h:len(q)-26};};
 const add=(cfg,model,scale=1)=>{
  const root=dyn(cfg.at,'encounter_'+cfg.id),node=w.prefab(root,model,[0,0,0],scale,Math.PI);
  const a={...cfg,type:'life',root,node,n:normalAt(...cfg.at),h:0,base:[0,0,0],talkUntil:0,lastUse:-100,prompt:'Say hello to '+cfg.name};actors.push(a);w.interactions.push(a);return a;
 };
 const route=(points)=>{w.path(points,1.3,'#dac7a0',.080);paths.push(points);};
 for(const points of LIFE_PATHS)route(points);
 const cloud=add(LIFE_SITES.find(s=>s.id==='brume'),'raincloud');cloud.node.position=[0,2.85,0];
 w.patch(cloud.at,1.7,1.35,'#aab8ac',.092);
 cloud.rain=new Node('local_rain');cloud.root.add(cloud.rain);for(let i=0;i<22;i++){const x=((i*13)%21)/21*2.3-1.15,z=((i*7)%19)/19*1.3-.65;const n=cloud.rain.part('cylinder','#b7ced0',[x,.1,z],[.019,.16,.019]);n.name='raindrop_'+i;n.unlit=true;}
 cloud.flowers=[];for(let i=0;i<7;i++){const a=i/7*Math.PI*2,g=w.prefab(cloud.root,'flower',[Math.cos(a)*1.64,.07,Math.sin(a)*1.22],.85);cloud.flowers.push(g);}
 cloud.rainbow=new Node('rainbow');cloud.root.add(cloud.rainbow);for(let j=0;j<3;j++)for(let i=0;i<14;i++){const a=i/13*Math.PI,n=cloud.rainbow.part('smooth',['#dfb099','#e2cd91','#97b9a3'][j],[Math.cos(a)*(1.2+j*.10),2.35+Math.sin(a)*(1.2+j*.10),-.35],[.15,.14,.05]);n.unlit=true;}cloud.rainbow.visible=false;
 const go=add(LIFE_SITES.find(s=>s.id==='nibs'),'gopher',1.05);go.holes=[[0,0,0],[1.8,-.045,-.8],[-1.55,-.04,-1.0]];go.holeIndex=0;
 const soil=w.rootAt(go.at);for(const p of go.holes)w.prefab(soil,'burrow',p);
 go.pebble=w.prefab(go.root,'ridge_stone',[.83,.16,.48],.19);go.pebble.visible=false;
 const bird=add({...LIFE_SITES.find(s=>s.id==='tilly'),at:[42,9]},'songbird',.90);bird.node.position=[0,.80,0];
 const perch=w.rootAt(bird.at);w.box(perch,'#a58c66',[0,.35,0],[2.7,.12,.50]);for(const x of [-1.05,1.05])w.box(perch,'#937855',[x,.16,0],[.1,.45,.16]);
 label(perch,[0,.55,.29],'WHISTLE & LISTEN',1.55,.25);
 bird.friends=[];for(const [i,x] of [[0,-.91],[1,.97]]){const n=w.prefab(bird.root,'songbird',[x,.47,0],.64,Math.PI+(i?-.2:.3));bird.friends.push(n);}
 for(let i=0;i<5;i++)perch.part('smooth','#e5cb8d',[(i-2)*.25,.43,.11],[.024,.018,.024]);
 const moss=add(LIFE_SITES.find(s=>s.id==='moss'),'tortoise_moss',1.10);moss.base=[0,0,0];
 const fern=add({id:'fern',name:'Fern',kind:'tortoise',at:moss.at,memory:'family'},'tortoise_fern',.90);fern.base=[-1.15,0,-1.65];
 const pipkin=add({id:'pipkin',name:'Pipkin',kind:'tortoise',at:moss.at,memory:'family'},'tortoise_pipkin',.56);pipkin.base=[.42,0,-2.65];
 for(const a of [fern,pipkin]){a.node.position=[...a.base];Object.assign(a,atPoint(a.root,a.base));}
 const familyRoot=dyn(moss.at,'family_picnic');const picnic=w.prefab(familyRoot,'picnic',[1.60,.1,1.15]);picnic.visible=false;
 const flower=w.prefab(familyRoot,'flower',[1.0,.03,-2.6],1.5);
 const board=w.rootAt([-50,5]);w.prefab(board,'sign',[1,0,0],.64,Math.PI);w.sign(board,[1,1.05,-.08],'THE SLOW PATH',1.15,.27,Math.PI);
 for(const cfg of LIFE_SITES.filter(s=>s.kind==='instrument')){
  const a=add(cfg,cfg.id==='marimba'?'rainwood_keys':'bottle_organ');a.prompt='Play '+cfg.name;a.node.rotation[1]=0;a.keys=Array.from({length:5},(_,i)=>a.node.find('key_'+i));a.rest=a.keys.map(n=>[...n.position]);a.notes=[-100,-100,-100,-100,-100];a.nextNote=0;
  instruments.push(a);const g=w.rootAt(cfg.at);label(g,[0,1.62,-.58],cfg.id==='marimba'?'RAINWOOD KEYS':'BOTTLE ORGAN',2.0,.31);
  a.glow=[];for(let i=0;i<5;i++){const n=w.prefab(a.root,'flower',[(i-2)*.54,.07,-1.05],.7);n.visible=false;a.glow.push(n);}
 }
 // A real flock, with named wings. The flight controller keeps them tangent to the globe.
 const flock=[];for(let i=0;i<5;i++){const r=dyn([0,0],'flying_bird_'+i),b=w.prefab(r,'songbird',[0,0,0],.44);flock.push({root:r,node:b,phase:i*1.28});}
 // Town residents are not delivery targets. E always starts a small conversation.
 const locals=[['bramble','Baker Bramble',['The first bun is for tasting. The second is for thinking about the first.','There are seed packets across the lane. Every garden starts small.']],['baths','Bathkeeper Fen',['You can rest here without a coffee. Warm water does most of the work.','Brume has found a place at the garden bend. Please do not ask for sunshine.']],['kiln','Potter Ash',['A crooked cup can still hold a good drink. I keep my first one.','The wheel goes round. The planet goes round. I think they understand each other.']],['usher','Usher Lumi',['Two short films are free. Come in. The front row is yours.','I like the part before a film starts. Anything could happen.']]];
 w.locals.forEach((local,i)=>{const [voice,name,lines]=locals[i];local.name=name;const m=local.root.matrix;const n=norm([m[12],m[13],m[14]]);w.interactions.push({id:'local_'+voice,type:'local',name,voice,lines,n,h:local.node.position[1],node:local.node,local,prompt:'Talk to '+name});});
 w.life={actors,instruments,cloud,gopher:go,bird,family:[moss,fern,pipkin],picnic,flower,flock,paths,atPoint};
}

export { addSmallLives };
