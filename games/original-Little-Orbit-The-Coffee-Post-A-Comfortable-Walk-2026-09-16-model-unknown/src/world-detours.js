import { DETOURS, DETOUR_TRAILS, DOORS, GLAZES } from './detour-spec.js';
import { placeBuilder } from './place-builder.js';
import { framePoint, normalAt, coordinates } from './physics.js';
import { norm, seeded, dot, clamp, slerp } from './math.js';

/** Open Doors adds usable rooms. Delivery state and earlier destinations stay intact. */
function addDetours(w){
 w.detours={items:DETOURS,objects:[],routes:[],access:[],grounds:[],clock:0};
 const h=placeBuilder(w),{point,dynamic,deck,rail,stairs,bridgeX,pathTo,activity,columns,board}=h;
 const {rootAt,prefab,box,orb,rod,solid,sign,patch,path}=w;
 const cream='#f4e5c6',wood='#ad825e',green='#678f80',rose='#cc8d79';
 const rng=seeded(6294),route=(id,points,high)=>{const r={id,points,high};w.detours.routes.push(r);return r;};
 const access=(id,points)=>w.detours.access.push({id,points});
 for(const t of DETOUR_TRAILS){path(t.points,t.width+.16,'#b9af97',.085);path(t.points,t.width,t.color,.105);}
 function clearDistance(n){let d=100;for(const t of DETOUR_TRAILS)for(let i=0;i<t.points.length-1;i++){const a=normalAt(...t.points[i]),b=normalAt(...t.points[i+1]);for(let j=0;j<=15;j++)d=Math.min(d,Math.acos(clamp(dot(n,slerp(a,b,j/15)),-1,1))*26);}return d;}
 // Coppercap Court: two shops, two upper rooms, and an open lane through the centre.
 const court=rootAt([44,26],Math.PI),courtMoving=dynamic([44,26],'coppercap_details',Math.PI),cy=3.14;
 patch([44,26],6.9,6.4,'#d9c7a6',.049);
 deck(court,0,0,10.4,5.8,.15,'court_ground');
 const lowS=stairs(court,{x:0,from:5.5,to:2.9,y:.15,width:2.6,id:'court_door_s'}),lowN=stairs(court,{x:0,from:-5.5,to:-2.9,y:.15,width:2.6,id:'court_door_n'});
 for(const [x,label,tint] of [[-3.05,'LETTER & LANTERN','#aebe9a'],[3.05,'TURN & TINKER','#d39e88']]){
  const shop=prefab(court,'shop_front',[x,.17,0]);shop.find('canopy').tint=[...(x<0?[.65,.75,.65]:[.83,.62,.51]),1];
  solid(court,[x,1.47,-1.43],[3.2,2.65,.16],'court_back');solid(court,[x,.75,-.42],[2.8,1.12,.89],'court_counter');
  sign(court,[x,2.42,1.4],label,2.90,.38);deck(court,x,-.04,3.72,4.1,cy,'court_upstairs');
  columns(court,[x-1.73,x+1.73],[-1.91,1.94],cy);
  // Open-front upper rooms. The back wall gives each shop a clear silhouette.
  box(court,x<0?'#d7cfb1':'#e0bdac',[x,cy+1.11,-2.03],[3.64,2.2,.12]);
  solid(court,[x,cy+1.10,-2.03],[3.64,2.2,.12],'court_upper_back');
  box(court,cream,[x+.78,cy+1.56,-1.94],[.95,.91,.06]);
  box(court,green,[x+.78,cy+1.56,-1.89],[.77,.72,.037]);
  box(court,cream,[x+.78,cy+1.56,-1.85],[.036,.75,.025]);
  box(court,cream,[x+.78,cy+1.56,-1.85],[.81,.036,.025]);
  const outer=x+(x<0?-1.80:1.80);
  box(court,x<0?'#d7cfb1':'#e0bdac',[outer,cy+.70,-.76],[.12,1.4,2.6]);
  solid(court,[outer,cy+.70,-.76],[.12,1.4,2.6],'court_upper_side');
  box(court,wood,[x,cy+2.24,-2.03],[3.87,.10,.23]);
  rail(court,[x-1.77,cy+.81,-2.03],[x+1.77,cy+.81,-2.03]);
  prefab(court,'pot',[x+1.36,cy,-1.49],.85);prefab(court,'lantern',[x-1.31,cy+.05,-1.52],.86);
 }
 const left=stairs(court,{x:-4.03,from:6.6,to:2.03,y:cy,id:'court_left_stair'}),right=stairs(court,{x:4.03,from:6.6,to:2.03,y:cy,id:'court_right_stair'});
 const bridge=bridgeX(court,{x0:-1.24,x1:1.24,z:-.22,y:cy,width:1.76,id:'coppercap_bridge'});
 const press=prefab(courtMoving,'postcard_press',[-3.05,cy,-.83]);activity(courtMoving,'postcard',[-3.05,cy+.02,.95],press);
 const toy=prefab(courtMoving,'toy_orrery',[3.05,1.27,-.36],.86);activity(courtMoving,'orrery',[3.05,.18,1.03],toy);
 const cards=[];for(let i=0;i<3;i++){const n=box(courtMoving,cream,[-3.73+i*.45,cy+1.35,-1.82],[.36,.44,.028],[0,0,(i-1)*.09]);cards.push(n);}
 w.detours.cards=cards;
 prefab(court,'archive_shelf',[-3.05,.17,-1.1],.63);
 prefab(court,'bench',[3.15,cy,-1.32],.84);prefab(court,'book',[2.61,cy+.61,-1.26],.75);
 sign(court,[0,4.57,-.24],'COPPERCAP COURT',3.3,.45);for(const x of [-1.55,1.55])rod(court,[x,cy,-.31],[x,4.95,-.31],.045,wood);
 for(const x of [-.87,-.29,.29,.87])prefab(court,'lantern',[x,4.37,-.31],.39);
 pathTo(DOORS.courtFront,[left.entry]);pathTo(DOORS.courtFront,[right.entry]);
 const courtRoute=route('coppercap_upper_loop',[normalAt(...DOORS.courtFront),left.entry,left.top,point(court,-4.03,cy,-.22).n,point(court,-1.35,cy,-.22).n,...bridge,point(court,4.03,cy,-.22).n,right.top,right.entry,normalAt(...DOORS.courtFront)],2.8);
 access('postcard',courtRoute.points.slice(0,4));access('orrery',[normalAt(...DOORS.courtFront),lowS.entry,lowS.top,point(court,0,.17,1.70).n]);
 // Greenhouse: open doors at both ends. The beds leave a wide, clear middle aisle.
 const glass=rootAt([1,-32]),glassMoving=dynamic([1,-32],'fernlight_growth');patch([1,-32],6.6,6.7,'#bfc593',.052);
 deck(glass,0,0,5.7,5.6,.16,'glasshouse_floor','#d4c49c');prefab(glass,'glasshouse_frame',[0,.17,0]);
 stairs(glass,{x:0,from:5.08,to:2.77,y:.16,width:2.1,id:'glass_front'});stairs(glass,{x:0,from:-5.08,to:-2.77,y:.16,width:2.1,id:'glass_back'});
 for(const x of [-1.84,1.84]){box(glass,'#a28767',[x,.37,-.48],[1.15,.42,3.2]);box(glass,'#746f53',[x,.59,-.48],[1.03,.035,3.08]);solid(glass,[x,.34,-.48],[1.15,.60,3.2],'glasshouse_bed');}
 const pods=[];for(const x of [-1.84,1.84])for(let i=0;i<5;i++)pods.push(prefab(glassMoving,'seed_pod',[x,.61,-1.76+i*.61],.8));
 const pump=prefab(glassMoving,'garden_pump',[1.86,.17,1.70],.86);activity(glassMoving,'greenhouse',[.50,.19,1.70],pump);w.detours.pods=pods;
 sign(glass,[0,3.23,2.72],'FERNLIGHT',2.75,.40);for(const x of [-3.35,3.35])prefab(glass,'pot',[x,-.16,2.2],1.35);
 for(let i=0;i<52;i++){
  const x=(rng()-.5)*14,z=(rng()-.5)*13,n=norm(framePoint(glass.matrix,[x,0,z]));
  if((Math.abs(x)<3.9&&Math.abs(z)<5.7)||clearDistance(n)<1.55)continue;
  const g=rootAt(coordinates(n),rng()*6.28);prefab(g,i%4===0?'fern_cluster':'grain',[0,0,0],.74+rng()*.5);
 }
 access('greenhouse',[normalAt(...DOORS.glassFront),point(glass,0,.18,2.45).n]);
 // Tumbledown is a real arched crossing. The stream is visible below the deck.
 const stone=rootAt([45,-30]),stoneMoving=dynamic([45,-30],'tumbledown_stones');
 patch([45,-30],7.1,6.8,'#aaa99a',.050);patch([45,-30],7.0,1.24,'#88aaa0',.066);patch([45,-30],6.5,.67,'#adc7b6',.075);
 for(let i=0;i<18;i++){
  const side=i%2?1:-1,x=(i%3===0?1.8:3.9)+rng()*1.3,z=side*(2.6+rng()*3.25),g=rootAt(coordinates(norm(framePoint(stone.matrix,[i%4<2?x:-x,0,z]))));
  if(clearDistance(norm([g.matrix[12],g.matrix[13],g.matrix[14]]))<1.5)continue;
  prefab(g,'ridge_stone',[0,0,0],.82+rng()*.47,rng()*3);solid(g,[0,.35,0],[.75,.68,.65],'tumbledown_rock');
 }
 const sy=2.03,segments=20;
 for(let i=0;i<segments;i++){
  const z=-2.2+(i+.5)*4.4/segments,y=sy+.24*Math.cos(z/2.2*Math.PI/2);
  box(stone,'#cfc9b3',[0,y-.12,z],[2.30,.24,.247]);w.surfaces.floor(stone.matrix,0,z,2.3,.285,y+.014,'stone_arch');
  for(const side of [-1,1]){box(stone,'#bbb69f',[side*1.0,y-.45,z],[.28,.38,.23]);}
 }
 for(const side of [-1,1])for(let i=0;i<6;i++){const a=-2.2+i*4.4/6,b=-2.2+(i+1)*4.4/6;if(side===1&&(i===2||i===3))continue;rail(stone,[side*1.18,sy+.8+.24*Math.cos(a/2.2*Math.PI/2),a],[side*1.18,sy+.8+.24*Math.cos(b/2.2*Math.PI/2),b],'#a89578');}
 // Leave an opening on the east rail for the lookout.
 w.surfaces.rails=w.surfaces.rails.filter(s=>!(s.id==='detour_rail'&&Math.abs(s.o[0]-stone.matrix[12])<.001&&Math.abs(s.o[2]-stone.matrix[14])<.001&&(s.a[0]+s.b[0])/2>1&&Math.abs((s.a[2]+s.b[2])/2)<.76));
 const sa=stairs(stone,{x:0,from:6.0,to:2.19,y:sy,width:2.3,id:'stone_s'}),sb=stairs(stone,{x:0,from:-7.4,to:-2.19,y:sy,width:2.3,id:'stone_n'});
 deck(stone,2.53,0,3.20,1.50,sy+.24,'stone_lookout');rail(stone,[1.25,sy+1.03,-.83],[4.10,sy+1.03,-.83]);rail(stone,[1.25,sy+1.03,.83],[4.10,sy+1.03,.83]);rail(stone,[4.15,sy+1.03,-.83],[4.15,sy+1.03,.83]);
 const cairn=prefab(stoneMoving,'cairn_stack',[3.48,sy+.26,-.09],.67);activity(stoneMoving,'cairn',[2.47,sy+.27,0],cairn);
 route('tumbledown_arch',[normalAt(...DOORS.stoneFront),sa.entry,sa.top,point(stone,0,sy+.24,0).n,sb.top,sb.entry,normalAt(...DOORS.stoneBack)],1.9);
 access('cairn',[normalAt(...DOORS.stoneFront),sa.entry,sa.top,point(stone,0,sy+.24,0).n]);
 // A tea terrace gives the baths another route to the southern paths.
 const bath=rootAt([35,-16]),bathMoving=dynamic([35,-16],'upper_bath_details'),by=2.72;
 deck(bath,6.8,0,3.8,4.4,by,'bath_terrace');columns(bath,[5.02,8.57],[-2.05,2.05],by);
 for(const x of [4.86,8.75])rail(bath,[x,by+.81,-2.13],[x,by+.81,2.13]);
 const ba=stairs(bath,{x:6.8,from:6.6,to:2.2,y:by,id:'bath_terrace_s'}),bb=stairs(bath,{x:6.8,from:-6.6,to:-2.2,y:by,id:'bath_terrace_n'});
 const basin=prefab(bathMoving,'leaf_basin',[6.8,by,-.85],.81);activity(bathMoving,'leafboat',[6.8,by+.025,.85],basin);
 prefab(bath,'bench',[5.32,by,.15],.65,Math.PI/2);prefab(bath,'pot',[8.22,by,-1.63],.8);sign(bath,[6.8,by+1.57,-2.17],'LEAF & WATER',2.45,.41);
 route('bath_terrace',[normalAt(...DOORS.bathFront),ba.entry,ba.top,point(bath,6.8,by,.8).n,point(bath,7.93,by,.8).n,point(bath,7.93,by,-1.35).n,point(bath,6.8,by,-1.8).n,bb.top,bb.entry,normalAt(...DOORS.bathBack)],2.5);
 access('leafboat',[normalAt(44,-7),normalAt(...DOORS.bathFront),ba.entry,ba.top]);
 // The drying loft leaves the original potter, wheel, and kiln below intact.
 const kiln=rootAt([57,-15]),kilnMoving=dynamic([57,-15],'drying_loft_details'),ky=3.13;
 deck(kiln,5.7,0,3.4,4.4,ky,'drying_loft');columns(kiln,[4.11,7.28],[-2.08,2.08],ky);
 for(const x of [3.95,7.44])rail(kiln,[x,ky+.81,-2.15],[x,ky+.81,2.15]);
 const ka=stairs(kiln,{x:5.7,from:6.6,to:2.2,y:ky,id:'kiln_loft_s'}),kb=stairs(kiln,{x:5.7,from:-6.6,to:-2.2,y:ky,id:'kiln_loft_n'});
 const tiles=prefab(kilnMoving,'tile_rack',[5.7,ky,-1.54]);activity(kilnMoving,'glaze',[5.7,ky+.025,.24],tiles);
 for(const [i,x] of [[0,4.52],[1,6.83]]){prefab(kiln,'glazed_mug',[x,ky,.82],.91);prefab(kiln,'pot',[x,ky,-1.82],.65);}
 sign(kiln,[5.7,ky+2.3,-1.89],'THE DRYING LOFT',2.77,.4);
 route('kiln_drying_loft',[normalAt(...DOORS.kilnFront),ka.entry,ka.top,point(kiln,5.7,ky,0).n,point(kiln,6.91,ky,0).n,point(kiln,6.91,ky,-1.05).n,point(kiln,5.7,ky,-1.05).n,kb.top,kb.entry,normalAt(...DOORS.kilnBack)],2.9);
 access('glaze',[normalAt(59,-4),normalAt(...DOORS.kilnFront),ka.entry,ka.top]);
 // Archive extension. A second canopy bridge and a switchback return to the wood.
 const archive=rootAt([-60,-17]),archiveMoving=dynamic([-60,-17],'fern_room_details'),ay=5.25;
 const up=stairs(archive,{x:8.27,from:-2.36,to:-5.01,y:ay,y0:3.734,width:1.94,id:'archive_annex_up'});
 deck(archive,8.27,-7,3.2,4.1,ay,'fern_east');deck(archive,1.4,-7,3.2,4.1,ay,'fern_room');
 const highBridge=bridgeX(archive,{x0:3.02,x1:6.69,z:-7,y:ay,width:1.80,id:'fern_bridge',bow:.21});
 rail(archive,[9.91,ay+.81,-9.0],[9.91,ay+.81,-5.0]);rail(archive,[6.65,ay+.81,-9.0],[9.91,ay+.81,-9.0]);
 rail(archive,[-.24,ay+.81,-9.0],[-.24,ay+.81,-5.0]);rail(archive,[-.2,ay+.81,-5.0],[3.0,ay+.81,-5.0]);
 // Two flights, with a landing. The second flight passes below the bridge.
 deck(archive,2.55,-13.0,4.65,1.48,2.35,'fern_turn_landing');
 const downHigh=stairs(archive,{x:1.4,from:-12.32,to:-9.04,y:ay,y0:2.365,width:1.82,id:'fern_switch_upper'});
 const downLow=stairs(archive,{x:3.75,from:-6.63,to:-12.31,y:2.35,width:1.82,id:'fern_switch_lower'});
 rail(archive,[.21,3.17,-13.77],[4.92,3.17,-13.77]);
 const folio=prefab(archiveMoving,'fern_press',[1.39,ay,-7.95]);activity(archiveMoving,'fernprint',[1.4,ay+.027,-6.43],folio);
 prefab(archive,'fern_cluster',[.12,ay,-5.57],1.40);prefab(archive,'pot',[2.6,ay,-8.71],.88);prefab(archive,'bench',[8.17,ay,-8.2],.83);
 sign(archive,[1.40,ay+2.18,-8.97],'THE FERN ROOM',2.82,.42);
 for(const x of [.03,2.78]){rod(archive,[x,ay,-8.87],[x,ay+2.53,-8.87],.06,wood);}
 box(archive,green,[1.4,ay+2.57,-8.55],[3.42,.11,1.35],[.05,0,0]);
 archive.part('cylinder','#8e7a61',[-.70,3.25,-8.94],[.33,10.6,.33]);
 for(let i=0;i<3;i++){
  rod(archive,[-.70,7.9,-8.94],[-1.4+i*.9,9.6+i*.32,-10.05],.14,'#8e7a61');
  orb(archive,['#92ad80','#b9c697','#9db98c'][i],[-1.4+i*.9,9.6+i*.32,-10.05],[1.5,1.0,1.4]);
 }
 const original=w.routeChecks.find(x=>x.id==='canopy_route');
 const eastDeck=point(archive,8.27,3.734,0).n;
 route('archive_fern_switchback',[...original.points.slice(0,-2),eastDeck,up.entry,up.top,point(archive,8.27,ay,-7).n,...[...highBridge].reverse(),point(archive,1.4,ay,-7).n,downHigh.top,downHigh.entry,point(archive,1.4,2.37,-13.0).n,point(archive,3.75,2.37,-13.0).n,downLow.top,downLow.entry,normalAt(...DOORS.archiveBack)],5.0);
 access('fernprint',[...original.points.slice(0,-2),eastDeck,up.entry,up.top,point(archive,8.27,ay,-7).n,...[...highBridge].reverse(),point(archive,1.4,ay,-7).n]);
 pathTo(DOORS.archiveBack,[downLow.entry]);
 // Open projection balcony. The cinema screen and its ground aisle remain clear.
 const cinema=rootAt([-27,24],Math.PI),cinemaMoving=dynamic([-27,24],'projection_balcony_details',Math.PI),py=3.47;
 deck(cinema,0,2.52,8.18,2.80,py,'cinema_balcony');rail(cinema,[-4.03,py+.81,3.94],[4.03,py+.81,3.94]);
 const sides=[];
 for(const x of [-5.7,5.7]){
  deck(cinema,x,2.53,2.05,2.65,py,'cinema_side_deck');columns(cinema,[x-.91,x+.91],[1.26,3.76],py);
  const stair=stairs(cinema,{x,from:8.4,to:3.84,y:py,width:1.9,id:x<0?'cinema_left_stair':'cinema_right_stair'});
  const a=x<0?-4.70:4.02,b=x<0?-4.02:4.70;bridgeX(cinema,{x0:a,x1:b,z:2.52,y:py,width:1.80,id:'cinema_side_bridge',bow:0});
  sides.push(stair);pathTo([-27,16],[stair.entry]);
 }
 const theatre=prefab(cinemaMoving,'shadow_theatre',[0,py,1.43],.87);activity(cinemaMoving,'shadowplay',[0,py+.025,3.12],theatre);
 for(const x of [-2.42,2.42])prefab(cinema,'cinema_chair',[x,py,1.81],.92,Math.PI);
 sign(cinema,[0,py+2.61,1.4],'THE PICTURE BEFORE THE PICTURE',4.63,.39);
 route('cinema_projection_balcony',[normalAt(...DOORS.cinemaLeft),sides[0].entry,sides[0].top,point(cinema,-5.7,py,2.52).n,point(cinema,-3.9,py,2.52).n,point(cinema,0,py,3.12).n,point(cinema,3.9,py,2.52).n,point(cinema,5.7,py,2.52).n,sides[1].top,sides[1].entry,normalAt(...DOORS.cinemaRight)],3.2);
 access('shadowplay',[normalAt(...DOORS.cinemaLeft),sides[0].entry,sides[0].top,point(cinema,-5.7,py,2.52).n,point(cinema,-3.9,py,2.52).n]);
 // Wide ground links form loops around the new stairs. Signs mark the junctions.
 for(const [at,text,heading] of [
 [[52,10],'COPPERCAP SHOPS  ↑',0],[[21,33],'COURT · RIDGE  →',0],[[38,34],'SHOPS BELOW  ↓',Math.PI],
 [[13,-27],'GLASSHOUSE  ←',0],[[24,-26],'STONE ARCH  →',0],[[36,-25],'BATH TERRACE  ↑',0],
 [[70,-18],'KILN LOFT  ←',0],[[-45,-29],'FERN ROOM  ←',0],
 [DOORS.cinemaLeft,'BALCONY  ↑',Math.PI],[DOORS.glassBack,'FIELDS · STONES  →',Math.PI]
 ])board(at,text,heading);
 // Named object motion is isolated from the renderer and the persistent state.
 w.detours.update=(dt,state)=>{
  w.detours.clock+=dt;const t=w.detours.clock,d=state.detours;
  for(const a of w.detours.objects){const n=a.node,age=t-a.lastUse,pulse=age>=0&&age<4,fade=pulse?Math.max(0,1-age/4):0;
   if(a.id==='postcard'){
    n.find('press_arm').position[1]=1.36-(age<1.2?Math.sin(Math.max(0,age)/1.2*Math.PI)*.23:0);n.find('printed_card').visible=d.memories.has('postcard');for(const card of cards)card.visible=d.memories.has('postcard');
   }else if(a.id==='orrery'){if(pulse){n.find('world_turn').rotation[1]+=dt*2.3*fade;n.find('moon_turn').rotation[1]+=dt*4.4*fade;n.find('wind_key').rotation[2]+=dt*7*fade;}}
   else if(a.id==='greenhouse'){
    n.find('pump_handle').rotation[2]=pulse?Math.sin(age*8)*.28*fade:0;n.find('flow').visible=pulse;
    const done=d.memories.has('greenhouse');for(let i=0;i<pods.length;i++){const s=done?.80:.36,growth=done&&age<3?Math.min(1,.45+age*.25):1;pods[i].scale=[s*growth,s*growth,s*growth];pods[i].rotation[2]=Math.sin(t*.65+i)*.025;}
   }else if(a.id==='leafboat'){const leaf=n.find('leaf_boat');leaf.visible=d.memories.has('leafboat');leaf.position=[Math.sin(t*.45)*.38,.55+Math.sin(t*.8)*.013,Math.cos(t*.45)*.22];leaf.rotation[1]=t*.45;}
   else if(a.id==='glaze'){for(let i=0;i<6;i++){const v=n.find('tile_'+i);if(d.memories.has('glaze')){const hex=GLAZES[(d.glaze+i%2)%GLAZES.length];v.tint=[...hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255),1];}v.rotation[2]=(i%2-.5)*Math.PI/15+(pulse?Math.sin(age*5+i)*.08*fade:0);}}
   else if(a.id==='fernprint'){n.find('fern_print').visible=d.memories.has('fernprint');n.find('book_cover').rotation[2]=age<1.2?Math.sin(Math.max(0,age)/1.2*Math.PI)*2.8:Math.PI;}
   else if(a.id==='shadowplay'){if(pulse){n.find('sky_wheel').rotation[2]+=dt*1.6;n.find('crank').rotation[0]+=dt*4.5;}n.find('screen').unlit=true;}
   else if(a.id==='cairn'){for(let i=0;i<3;i++){const stone=n.find('stone_'+i);stone.visible=i<d.stones;stone.rotation[2]=i===d.stones-1&&pulse?Math.sin(age*8)*.075*fade:0;}}
  }
 };
}

export { addDetours };
