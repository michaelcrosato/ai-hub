import { addWayfinding } from './wayfinding.js';
import { addPost } from './post.js';
import { addSunroom } from './world-sunroom.js';
import { SUNROOM_PATH } from './sunroom-spec.js';
import { addDetours } from './world-detours.js';
import { DETOUR_TRAILS } from './detour-spec.js';
import { LIFE_PATHS } from './life-spec.js';
import { addSmallLives } from './life-world.js';
import { addExpansion } from './world-expansion.js';
import { TRAILS } from './expansion-spec.js';
import { Node } from './engine.js';
import { sphere, meshData, tri } from './geometry.js';
import { CONFIG, NEIGHBORS, REGIONS, MAIN_PATH } from './config.js';
import { normalAt, frameAt, framePoint, frameNormal, Surfaces } from './physics.js';
import { C } from './asset-spec.js';
import { ident, compose, mmul, vmul, vadd, vsub, norm, cross, dot, slerp, basis, color, seeded, len, transform } from './math.js';

function buildWorld(renderer,assets){
 const statics=[],dynamics=[],surfaces=new Surfaces(),interactions=[],pets=[],labels=[],wonders=[];
 const random=seeded(CONFIG.seed);let count=0;
 const rootAt=(at,heading=0)=>{const g=new Node('place_'+count++);g.matrix=frameAt(...at,heading);statics.push(g);return g;};
 const prefab=(parent,name,p=[0,0,0],scale=1,heading=0)=>{const a=assets.get(name);a.position=p;a.scale=[scale,scale,scale];a.rotation[1]=heading;parent.add(a);return a;};
 const box=(g,col,p,s,r=[0,0,0],name='block')=>g.part('box',col,p,s,r,name);
 const orb=(g,col,p,s,name='round')=>g.part('pebble',col,p,s,[0,0,0],name);
 const solid=(g,p,s,id)=>surfaces.solid(g.matrix,p,s,id);
 const sign=(g,p,text,w=2,h=.65,heading=0,bg=C.cream)=>{const a=new Node('sign_'+text);a.position=p;a.rotation=[0,heading,0];g.add(a);box(a,C.wood,[0,0,-.035],[w+.10,h+.12,.1]);const f=a.part('plane',C.white,[0,0,.022],[w,h,1]);f.texture=renderer.textTexture(text,text,{bg,size:text.includes('\n')?39:44,height:text.includes('\n')?224:160});f.unlit=true;return a;};
 const rod=(g,a,b,r,col)=>{const y=norm(vsub(b,a)),x=norm(cross(Math.abs(y[1])<.9?[0,1,0]:[1,0,0],y)),z=cross(x,y);const n=new Node('rail');n.mesh='cylinder';n.tint=[...color(col),1];n.matrix=mmul(basis(x,y,z,vmul(vadd(a,b),.5)),compose([0,0,0],[0,0,0],[r,len(vsub(b,a)),r]));g.add(n);return n;};
 function patch(at,rx,rz,col,y=.025){const m=frameAt(...at),g=meshData();const center=normalAt(...at);for(let i=0;i<56;i++){const a=i/56*Math.PI*2,b=(i+1)/56*Math.PI*2;const u=norm(framePoint(m,[Math.cos(a)*rx,0,Math.sin(a)*rz])),v=norm(framePoint(m,[Math.cos(b)*rx,0,Math.sin(b)*rz]));tri(g,vmul(center,CONFIG.radius+y),vmul(v,CONFIG.radius+y),vmul(u,CONFIG.radius+y),[center,v,u]);}const id='patch'+count++;renderer.register(id,g);const n=new Node(id);n.mesh=id;n.tint=[...color(col),1];statics.push(n);return n;}
 function path(points,width,col,y=.046){const g=meshData();for(let k=0;k<points.length-1;k++){const a=normalAt(...points[k]),b=normalAt(...points[k+1]),angle=Math.acos(Math.min(1,dot(a,b))),steps=Math.max(2,Math.ceil(angle*CONFIG.radius/.65));const side=norm(cross(a,b));for(let i=0;i<steps;i++){const n0=slerp(a,b,i/steps),n1=slerp(a,b,(i+1)/steps);const L0=norm(vadd(n0,vmul(side,width/CONFIG.radius/2))),R0=norm(vsub(n0,vmul(side,width/CONFIG.radius/2))),L1=norm(vadd(n1,vmul(side,width/CONFIG.radius/2))),R1=norm(vsub(n1,vmul(side,width/CONFIG.radius/2)));const p=[L0,R0,L1,R1].map(n=>vmul(n,CONFIG.radius+y));tri(g,p[0],p[1],p[2],[L0,R0,L1]);tri(g,p[1],p[3],p[2],[R0,R1,L1]);}}for(const at of points.slice(1,-1)){
 const center=normalAt(...at),m=frameAt(...at);for(let j=0;j<16;j++){
  const a=j/16*Math.PI*2,b=(j+1)/16*Math.PI*2;
  const u=norm(framePoint(m,[Math.cos(a)*width/2,0,Math.sin(a)*width/2])),v=norm(framePoint(m,[Math.cos(b)*width/2,0,Math.sin(b)*width/2]));
  tri(g,vmul(center,CONFIG.radius+y),vmul(v,CONFIG.radius+y),vmul(u,CONFIG.radius+y),[center,v,u]);
 }
}const id='path'+count++;renderer.register(id,g);const n=new Node(id);n.mesh=id;n.tint=[...color(col),1];statics.push(n);}
 const globe=sphere(112,72);for(let i=0;i<globe.p.length;i+=3){const [x,y,z]=globe.p.slice(i,i+3);const d=.025*Math.sin(x*18+z*9)*Math.sin(y*23-z*6)+.013*Math.cos(z*28+x*10);globe.c[i]=1+d;globe.c[i+1]=1+d;globe.c[i+2]=1+d;globe.p[i]*=CONFIG.radius;globe.p[i+1]*=CONFIG.radius;globe.p[i+2]*=CONFIG.radius;}
 renderer.register('planet',globe);const planet=new Node('Little Orbit');planet.mesh='planet';planet.tint=[...color('#b6c995'),1];statics.push(planet);
 // Wide paths curve around the entire globe, including the far side.
 path(MAIN_PATH,2.9,'#bba981',.025);path(MAIN_PATH,2.6,'#e7cf9f',.055);
 path([[0,4],[6,6],[7.5,12],[8,17],[8,19]],1.7,'#ead9b0');path([[-3.7,12],[-6,12],[-12,12],[-18,10],[-18,2],[-9,-3]],1.65,'#ead9b0');
 patch([-1,12],5.2,5.4,'#e7d5ae',.063);
 // A roof-cutaway café. The player starts beside the machine, not outside.
 const cafe=rootAt([0,0]);box(cafe,C.wood,[0,-.04,0],[8,.30,6.4]);box(cafe,'#f2dcb2',[0,.12,0],[7.85,.05,6.2]);surfaces.floor(cafe.matrix,0,0,8,6.4,.145,'cafe');
 for(let i=0;i<3;i++){const z=3.28+i*.35,y=.10-i*.12;box(cafe,C.wood,[0,y-.12,z],[4.2,.24,.37]);surfaces.floor(cafe.matrix,0,z,4.2,.39,y,'cafe_step');}
 for(let x=-3.5;x<4;x+=.50)box(cafe,'#d7b48b',[x,.153,0],[.015,.014,6.2]);
 box(cafe,'#e7c4a0',[-3.9,1.15,0],[.16,2.3,6.4]);solid(cafe,[-3.9,1.15,0],[.16,2.3,6.4],'cafe_wall');
 box(cafe,'#e7c4a0',[0,.60,-3.13],[8,1.2,.16]);solid(cafe,[0,.60,-3.13],[8,1.2,.16],'cafe_wall');
 box(cafe,'#edd1a8',[3.91,.50,0],[.16,1.0,6.4]);solid(cafe,[3.91,.5,0],[.16,1,6.4],'cafe_wall');
 for(const z of [-2.8,2.8]){box(cafe,C.wood,[-3.3,1.98,z],[.16,3.8,.16]);box(cafe,C.wood,[-2.8,1.98,z],[.16,3.8,.16]);}
 box(cafe,C.orange,[-3.45,3.86,0],[1.4,.20,6.7]);for(let z=-3.3;z<3.4;z+=.46)box(cafe,'#f7dda9',[-3.45,3.98,z],[1.4,.045,.22]);
 box(cafe,C.teal,[-2.75,.65,-.25],[1.5,1.3,3.75]);box(cafe,C.wood,[-2.75,1.33,-.25],[1.70,.14,3.95]);solid(cafe,[-2.75,.66,-.25],[1.65,1.4,3.95],'coffee_counter');
 const machineRoot=new Node('cafe_machine_root');machineRoot.matrix=cafe.matrix;dynamics.push(machineRoot);
 const espresso=prefab(machineRoot,'espresso_machine',[-2.76,1.42,-.65],.68,Math.PI/2);
 const machineView={target:framePoint(cafe.matrix,[-2.51,2.18,-.65]),front:[1,0,0],up:[0,1,0]};
 prefab(cafe,'pot',[-2.70,1.40,1.25],.75);prefab(cafe,'coffee',[-1.98,1.42,-.1],.85);
 const machineN=frameNormal(cafe.matrix,-1.15,-.65);interactions.push({id:'machine',type:'machine',name:'Coffee machine',n:machineN,h:.16,prompt:'Brew four coffees'});
 sign(cafe,[2.0,1.38,-3.26],'LITTLE ORBIT\nCOFFEE POST',2.8,.85,Math.PI);
 for(const x of [.54,3.45])box(cafe,C.wood,[x,.94,-3.15],[.12,1.88,.12]);
 cafe.part('cylinder',C.wood,[1.8,.95,.1],[.76,.12,.76]);cafe.part('cylinder',C.teal,[1.8,.49,.1],[.12,.94,.12]);solid(cafe,[1.8,.5,.1],[1.1,1,1.1],'table');
 prefab(cafe,'stool',[1.05,.16,1.1]);prefab(cafe,'stool',[2.9,.16,-.1]);prefab(cafe,'pot',[3.4,.16,2.5],1.4);
 for(let i=0;i<4;i++)box(cafe,['#ecc479','#f3e2b3','#c9d0a4','#f3c8ac'][i],[1.6+(i%2)*.57,1.42+Math.floor(i/2)*.44,-3.04],[.43,.33,.05],[0,0,(i-1.5)*.08]);
 const cafelight=rod(cafe,[-3.3,3.5,2.8],[3.6,2.7,2.8],.022,C.darkwood);for(let i=0;i<7;i++)cafe.part('smooth',C.yellow,[-3.3+i*1.1,3.4-i*.12,2.8],[.11,.15,.11]);
 const cafeSign=rootAt([4,4],.2);prefab(cafeSign,'sign');sign(cafeSign,[0,1.67,.09],'BREW · WANDER',1.84,.47,0);
 // Houses have separate walls, roofs, window frames, and garden details.
 function house(at,col,width=4.3,height=3.5,heading=0){const g=rootAt(at,heading),d=3.8;box(g,col,[0,height/2-.1,0],[width,height,d]);solid(g,[0,height/2-.1,0],[width,height,d],'house');box(g,C.cream,[0,.20,0],[width+.16,.33,d+.16]);g.part('roof','#bd7357',[0,height-.12,0],[width+1.0,2.65,d+1]);
  for(const x of [-width*.28,width*.28]){box(g,C.cream,[x,1.96,-d/2-.08],[.97,1.17,.17]);box(g,'#7eaaa3',[x,1.96,-d/2-.18],[.77,.95,.08]);box(g,C.cream,[x,1.96,-d/2-.235],[.06,.95,.03]);box(g,C.cream,[x,1.96,-d/2-.24],[.8,.065,.03]);box(g,C.wood,[x,1.30,-d/2-.21],[1.12,.13,.36]);for(let i=0;i<3;i++)orb(g,['#abc287','#e6bc98','#b1be8a'][i],[x+(i-1)*.28,1.5,-d/2-.22],[.22,.22,.20]);}
  box(g,C.teal,[0,.91,-d/2-.09],[.88,1.85,.13]);orb(g,C.yellow,[.27,1.0,-d/2-.17],[.046,.046,.046]);box(g,C.cream,[0,1.91,-d/2-.1],[1.10,.13,.20]);box(g,C.orange,[width*.24,height+1.07,.70],[.60,1.1,.65]);box(g,C.cream,[width*.24,height+1.64,.70],[.76,.15,.78]);
  prefab(g,'pot',[-width*.55,0,-1.5],1.1);prefab(g,'mailbox',[width*.6,0,-1.1],.8);return g;
 }
 house([-9,16],'#ddb098',4.5,3.4,-.1);house([-14,6],'#eac980',3.9,3.6,-.85);house([3,21],'#bad0bf',4.5,3.5,.3);house([31,21],'#edc7aa',3.8,3.3,.7);house([8,-7],'#d2b6ab',3.6,3.2,2.3);house([-8,-8],'#e3be82',3.8,3.2,-2.5);
 // Square, fountain, stalls, and lamps.
 const square=rootAt([-1,12]);square.part('cylinder','#c2b594',[0,.2,0],[1.48,.4,1.48]);square.part('cylinder','#81b9b0',[0,.42,0],[1.26,.075,1.26]);square.part('cylinder',C.cream,[0,.72,0],[.24,.80,.24]);square.part('smooth','#9dc4b7',[0,1.17,0],[.25,.42,.25]);solid(square,[0,.38,0],[2.65,.8,2.65],'fountain');
 prefab(square,'bench',[-3.2,.02,-1.1],1,-.3);prefab(square,'bench',[3.2,.02,1.2],1,2.8);prefab(square,'lamp',[-3.8,0,2.9]);prefab(square,'lamp',[3.9,0,-2.8]);
 const stall=rootAt([-6,9],.5);box(stall,C.wood,[0,.65,0],[2.6,1.3,.9]);for(const x of [-1.28,1.28])box(stall,C.wood,[x,1.5,0],[.10,3,.10]);box(stall,'#d58c76',[0,2.94,0],[3.05,.14,1.7]);for(let x=-1.4;x<1.5;x+=.46)box(stall,C.cream,[x,3.025,0],[.22,.025,1.7]);for(let i=0;i<8;i++)orb(stall,['#df9c62','#e9c475','#a4b783'][i%3],[(i%4-.5)*.40-.5,1.41,Math.floor(i/4)*.30-.17],[.17,.16,.17]);solid(stall,[0,.65,0],[2.6,1.3,.9],'stall');
 // Two real staircases, a reading room, and an overhead footbridge.
 const library=rootAt([13,9]);const deckY=3.35;
 box(library,'#d0ac83',[-3,1.48,-.7],[4.4,3.5,4.8]);solid(library,[-3,1.30,-.7],[4.4,3.14,4.8],'library_lower');
 box(library,C.wood,[-3,deckY-.13,-.7],[4.8,.26,4.8]);surfaces.floor(library.matrix,-3,-.7,4.8,4.8,deckY,'reading_room');
 box(library,'#f4e0ba',[-3,deckY+.6,-3.02],[4.8,1.2,.16]);solid(library,[-3,deckY+.6,-3.02],[4.8,1.2,.16],'library_wall');box(library,'#efd2a6',[-5.32,deckY+.6,-.7],[.14,1.2,4.8]);solid(library,[-5.32,deckY+.6,-.7],[.14,1.2,4.8],'library_wall');
 for(const x of [-5.2,-.8])for(const z of [-2.8,1.5])box(library,C.wood,[x,4.50,z],[.13,2.5,.13]);for(let x=-5.3;x<-.6;x+=.65)box(library,C.wood,[x,5.77,-2.45],[.12,.13,1.20]);
 sign(library,[-3,2.15,1.76],'THE SKY LIBRARY',3.2,.68,0);sign(library,[-3,4.45,-2.91],'ONE MORE CHAPTER',2.85,.60,0);
 for(let x=-4.5;x<-1.5;x+=.6){prefab(library,'book',[x,deckY,-2.35],1,random());prefab(library,'book',[x,deckY+.26,-2.35],.9,random());}prefab(library,'pot',[-4.7,deckY,.9],1.15);prefab(library,'bench',[-4.2,deckY,-.9],.8,Math.PI/2);
 function stairs(x,from=7.7,to=1.73){const N=23,startY=Math.sqrt(CONFIG.radius**2-x*x-from*from)-CONFIG.radius;for(let i=0;i<N;i++){const z=from+(to-from)*(i+.5)/N,y=startY+(deckY-startY)*(i+1)/N;const depth=(from-to)/N+.025;const bottom=Math.min(-1.7,startY-.25);box(library,'#ceab7b',[x,(y+bottom)/2,z],[1.95,y-bottom,depth]);}
  // A continuous support ramp keeps capsule feet from catching on tread edges.
  surfaces.ramp(library.matrix,x,from+.06,to-.06,1.95,startY+.06,deckY);
  for(const dx of [-1.02,1.02]){surfaces.rail(library.matrix,[x+dx,startY+.78,from],[x+dx,deckY+.78,to],'library_stair_rail');rod(library,[x+dx,startY+.78,from],[x+dx,deckY+.78,to],.055,C.wood);for(let i=0;i<5;i++){const t=i/4,z=from+(to-from)*t,y=startY+(deckY-startY)*t;rod(library,[x+dx,y,z],[x+dx,y+.78,z],.045,C.wood);}}
 }
 stairs(-3);stairs(7.3);
 box(library,C.wood,[7.3,deckY-.13,-.7],[3.2,.26,4.8]);surfaces.floor(library.matrix,7.3,-.7,3.2,4.8,deckY,'east_deck');
 for(const x of [6,8.6])for(const z of [-2.75,1.5])rod(library,[x,-1,z],[x,deckY+.8,z],.1,C.wood);
 for(let i=0;i<32;i++){const t=(i+.5)/32,x=-.6+t*6.4,y=deckY+.34*Math.sin(t*Math.PI);box(library,'#c89968',[x,y-.085,-.70],[.21,.17,1.65]);surfaces.floor(library.matrix,x,-.70,.24,1.68,y,'skybridge');for(const z of [-1.59,.19]){if(i%4===0)rod(library,[x,y,z],[x,y+.80,z],.045,C.wood);if(i<31){const t2=(i+1.5)/32,x2=-.6+t2*6.4,y2=deckY+.34*Math.sin(t2*Math.PI);rod(library,[x,y+.76,z],[x2,y2+.76,z],.042,C.wood);}solid(library,[x,y+.60,z],[.23,.42,.10],'bridge_rail');}}
 for(const z of [-2.97]){rod(library,[5.72,deckY+.75,z],[8.88,deckY+.75,z],.045,C.wood);if(z<0)solid(library,[7.3,deckY+.6,z],[3.2,.5,.10],'deck_rail');}
 const stairsSign=rootAt([10,18]);prefab(stairsSign,'sign', [0,0,0],.8);sign(stairsSign,[0,1.33,.07],'LIBRARY  ↑',1.47,.35,0);
 // Nature landmarks are spread around the globe.
 patch([43,5],9,7,'#c1cc91',.017);const orchard=rootAt([40,5]);prefab(orchard,'bench',[2,-.1,-2],1,2.5);prefab(orchard,'pot',[-2,0,-1],1.25);prefab(orchard,'sign',[0,0,3.4],.9);sign(orchard,[0,1.48,3.48],'APRICOT ORCHARD',1.63,.39,0);
 const fruitRoot=new Node('old_apricot');fruitRoot.matrix=frameAt(43,2);const fruitTree=prefab(fruitRoot,'apricot');dynamics.push(fruitRoot);const fruitN=normalAt(43,3.5);interactions.push({id:'apricot',type:'tree',name:'Old apricot tree',n:fruitN,h:0,prompt:'Shake the tree',node:fruitTree});
 for(const at of [[37,0],[39,11],[46,8],[48,1],[35,8],[45,-4]]){const g=rootAt(at);prefab(g,'apricot',[0,0,0],.82+random()*.25,random()*6.28);solid(g,[0,1.2,0],[.45,2.4,.45],'tree');}
 patch([-49,12],5.9,4.7,'#d5c89f',.07);patch([-49,12],5.2,4.0,'#86b8ad',.11);patch([-49,12],4.6,3.4,'#9ac6b7',.125);
 const pond=rootAt([-49,12]);for(let i=0;i<11;i++){const a=random()*6.28,r=2.0+random()*2.6,x=Math.cos(a)*r,z=Math.sin(a)*r*.7;const n=frameNormal(pond.matrix,x,z),g=rootAt([Math.atan2(n[0],n[1])*26,Math.asin(n[2])*26]);g.part('cylinder','#7f9e73',[0,.135,0],[.40,.025,.31]);if(i%3===0)prefab(g,'flower',[0,.15,0],.6);}
 const boatRoot=new Node('paper_boat');boatRoot.matrix=frameAt(-49,12);const boat=prefab(boatRoot,'boat',[.2,.24,.4],.75,.7);dynamics.push(boatRoot);interactions.push({id:'boat',type:'boat',name:'Paper boat',n:normalAt(-48,10.6),h:0,prompt:'Give the boat a push',node:boat});
 const dock=rootAt([-48,7]);for(let i=0;i<10;i++)box(dock,C.wood,[0,-.03,i*.38],[1.7,.12,.34]);surfaces.floor(dock.matrix,0,1.7,1.7,3.7,.03,'pond_dock');prefab(dock,'bench',[-3,-.1,0],1,.8);
 const meadow=rootAt([-22,-7]);for(let i=0;i<5;i++){const x=(i%3-1)*.73,z=Math.floor(i/3)*.76;prefab(meadow,'mushroom',[x,0,z],.55+random()*.5,random()*6);}
 const bounce=assets.get('mushroom');const mushRoot=new Node('singing_mushroom');mushRoot.matrix=frameAt(-22,-9);mushRoot.add(bounce);dynamics.push(mushRoot);interactions.push({id:'mushroom',type:'mushroom',name:'Singing mushroom',n:normalAt(-22,-9),h:0,prompt:'Tap the mushroom',node:bounce});
 const bellRoot=new Node('wind_bell');bellRoot.matrix=frameAt(79,5);const bell=assets.get('bell');bellRoot.add(bell);dynamics.push(bellRoot);interactions.push({id:'bell',type:'bell',name:'Wind bell',n:normalAt(79,6.3),h:0,prompt:'Ring the wind bell',node:bell.find('swing')});
 const hill=rootAt([79,5]);prefab(hill,'bench',[3,-.15,1],1,-.8);for(let i=0;i<8;i++)orb(hill,'#c8bfa7',[Math.cos(i/8*6.28)*3.5,-.1,Math.sin(i/8*6.28)*3.5],[.5,.3,.5]);
 // Direction boards make routes legible without revealing neighbor markers.
 for(const [at,text,heading]of [[[21,12],'ORCHARD  →',.2],[[-11,-3],'POND  ←',-.4],[[58,5],'WIND BELL  →',0],[[-67,8],'LILY POND  →',0]]){const g=rootAt(at,heading);prefab(g,'sign', [0,0,0],.85);sign(g,[0,1.4,.08],text,1.55,.38);}
 // Deliberate, sparse plant placement. Avoid the town and the main path.
 // Route samples do not change while the world is built. Calculate them once.
 const pathSamples=[];
 for(const points of [MAIN_PATH,SUNROOM_PATH,...TRAILS.map(t=>t.points),...LIFE_PATHS,...DETOUR_TRAILS.map(t=>t.points)])for(let k=0;k<points.length-1;k++){
  const a=normalAt(...points[k]),b=normalAt(...points[k+1]);for(let j=0;j<=12;j++)pathSamples.push(slerp(a,b,j/12));
 }
 function pathDistance(n){let nearest=-1;for(const p of pathSamples)nearest=Math.max(nearest,dot(n,p));return Math.acos(Math.min(1,nearest))*26;}
 for(let i=0;i<145;i++){const u=(random()-.5)*163,v=(random()-.5)*62,n=normalAt(u,v);if((Math.abs(u)<26&&v>-14&&v<28)||pathDistance(n)<3.3||REGIONS.some(r=>r.id!=='cafe'&&Math.acos(Math.min(1,dot(n,normalAt(...r.at))))*26<7))continue;const g=rootAt([u,v],random()*6.28);const type=(u<0?'pine':random()<.3?'pine':'oak');const sc=.6+random()*.48;prefab(g,type,[0,0,0],sc);solid(g,[0,sc,0],[.36,2*sc,.36],'tree');}
 for(let i=0;i<170;i++){const u=(random()-.5)*163,v=(random()-.5)*65;if((Math.abs(u)<23&&v>-11&&v<27)||pathDistance(normalAt(u,v))<1.7||REGIONS.some(r=>Math.acos(Math.min(1,dot(normalAt(u,v),normalAt(...r.at))))*26<r.radius))continue;const g=rootAt([u,v],random()*6.28);if(i%4===0)orb(g,'#acac94',[0,0,0],[.35+random()*.35,.2+random()*.3,.4]);else prefab(g,'flower',[0,0,0],.6+random()*.8);}
 for(const [at,type,s] of [[[5,3],'oak',.9],[[-6,3],'oak',.8],[[-7,22],'oak',1],[[-20,12],'pine',.9],[[1,30],'oak',.7],[[23,3],'oak',1],[[27,19],'oak',1],[[-17,-12],'pine',.8],[[-37,12],'pine',1.2],[[-56,7],'pine',1.15],[[-53,18],'pine',1.2]]){const g=rootAt(at);prefab(g,type,[0,0,0],s);solid(g,[0,1.5,0],[.4,3,.4],'tree');}
 // Neighbors are real animated mesh characters with independent one-shot delivery state.
 for(const cfg of NEIGHBORS){const m=frameAt(...cfg.at),n=cfg.local?frameNormal(m,...cfg.local):normalAt(...cfg.at);const ground=cfg.local?(dot([m[12],m[13],m[14]],[m[4],m[5],m[6]])+cfg.height)/dot(n,[m[4],m[5],m[6]])-CONFIG.radius:0;
  const root=new Node(cfg.id);root.matrix=frameAt(Math.atan2(n[0],n[1])*26,Math.asin(n[2])*26,cfg.heading);const pet=assets.get(cfg.pet);pet.position[1]=ground;root.add(pet);dynamics.push(root);const p={...cfg,n,h:ground,node:pet,root,talkTime:0,cup:null};pets.push(p);interactions.push({...p,type:'neighbor',name:cfg.name,prompt:'Give a warm coffee'});
 }
 const world={statics,dynamics,surfaces,interactions,pets,labels,wonders,assets,cafe,machineN,espresso,machineView,fruitTree,boat,bell,renderer,regions:REGIONS.map(r=>({...r,n:normalAt(...r.at)})),prefab,rod,rootAt,box,orb,solid,sign,patch,path};
 addExpansion(world);addSmallLives(world);addDetours(world);addSunroom(world);addWayfinding(world);addPost(world);return world;
}

export { buildWorld };
