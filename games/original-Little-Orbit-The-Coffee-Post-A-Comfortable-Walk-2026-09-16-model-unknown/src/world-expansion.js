import { DETOUR_TRAILS, DOORS } from './detour-spec.js';
import { Node } from './engine.js';
import { CONFIG } from './config.js';
import { TRAILS } from './expansion-spec.js';
import { frameAt, framePoint, frameNormal, normalAt, coordinates } from './physics.js';
import { norm, len, dot, clamp, slerp, seeded, color, vsub } from './math.js';

/** Add places without changing coffee delivery or the courier rig. */
function addExpansion(w){
 const {rootAt,prefab,box,orb,solid,sign,rod,patch,path,surfaces,statics,dynamics,interactions}=w;
 const random=seeded(3361),R=CONFIG.radius;
 const cream='#fff1d1',wood='#aa7955',dark='#765547',sage='#547e72';
 w.activities=[];w.locals=[];w.routeChecks=[];w.expansion={};
 const point=(g,x,y,z)=>{const p=framePoint(g.matrix,[x,y,z]);return {n:norm(p),h:len(p)-R};};
 const surfaceY=(x,z)=>Math.sqrt(Math.max(1,R*R-x*x-z*z))-R;
 function dynamic(at,heading=0,name='moving_detail'){const g=new Node(name);g.matrix=frameAt(...at,heading);dynamics.push(g);return g;}
 function onGround(g,x,z,heading=0){return rootAt(coordinates(frameNormal(g.matrix,x,z)),heading);}
 function activity(g,id,kind,p,prompt,extra={}){const target={id,type:'activity',kind,...point(g,...p),prompt,name:prompt,...extra};interactions.push(target);w.activities.push(target);return target;}
 function deck(g,x,z,width,depth,y,id){box(g,wood,[x,y-.12,z],[width,.24,depth]);box(g,'#e4c79b',[x,y+.006,z],[width-.04,.018,depth-.04]);surfaces.floor(g.matrix,x,z,width,depth,y+.018,id);for(let p=x-width/2+.3;p<x+width/2;p+=.48)box(g,'#bd9c76',[p,y+.02,z],[.012,.018,depth-.07]);}
 function rail(g,a,b){rod(g,a,b,.043,wood);const mid=a.map((v,i)=>(v+b[i])/2),size=a.map((v,i)=>Math.abs(b[i]-v)+.07);size[1]=.60;surfaces.rail(g.matrix,a,b,'new_rail');const steps=Math.max(1,Math.ceil(len(vsub(b,a))/.85));for(let i=0;i<=steps;i++){const p=a.map((v,k)=>v+(b[k]-v)*i/steps);rod(g,[p[0],p[1]-.75,p[2]],p,.045,wood);}}
 function stairs(g,{x,from,to,y,width=1.9,id}){
  const y0=surfaceY(x,from)-.02,N=Math.ceil((y-y0)/.18),bottom=Math.min(y0-.15,-2.5),depth=Math.abs(from-to)/N+.028;
  for(let i=0;i<N;i++){const z=from+(to-from)*(i+.5)/N,h=y0+(y-y0)*(i+1)/N;box(g,'#c8a57d',[x,(h+bottom)/2,z],[width,h-bottom,depth]);box(g,'#e5c59a',[x,h+.009,z],[width,.019,depth*.22]);}
  surfaces.ramp(g.matrix,x,from+Math.sign(from-to)*.07,to-Math.sign(from-to)*.07,width,y0,y+.025);
  for(const side of [-1,1])rail(g,[x+side*(width/2+.06),y0+.80,from],[x+side*(width/2+.06),y+.80,to]);
  return {entry:point(g,x,y0,from+.45*Math.sign(from-to)).n,top:point(g,x,y,to-.12*Math.sign(from-to)).n};
 }
 function bridge(g,{x0,x1,z,y,width=1.8,id}){
  const count=Math.ceil((x1-x0)/.24),walk=[];
  for(let i=0;i<count;i++){const t=(i+.5)/count,x=x0+(x1-x0)*t,h=y+.19*Math.sin(t*Math.PI);box(g,'#c4946e',[x,h-.08,z],[(x1-x0)/count+.015,.16,width]);surfaces.floor(g.matrix,x,z,(x1-x0)/count+.06,width,h,id);if(i%4===0)walk.push(point(g,x,h,z).n);}
  for(const side of [-1,1]){const zz=z+side*(width/2+.05);for(let i=0;i<8;i++){const t=i/8,t1=(i+1)/8;rail(g,[x0+(x1-x0)*t,y+.82+.19*Math.sin(t*Math.PI),zz],[x0+(x1-x0)*t1,y+.82+.19*Math.sin(t1*Math.PI),zz]);}}
  return walk;
 }
 function entry(g,{x=0,z=4,y=.16,width=2.4,id}){return stairs(g,{x,from:z+2.1,to:z-.08,y,width,id});}
 function keeper(g,pet,p,heading,name){const a=dynamic(coordinates(norm(framePoint(g.matrix,p))),heading,name),model=prefab(a,pet,[0,len(framePoint(g.matrix,p))-R,0],.88);w.locals.push({root:a,node:model,name});return model;}
 function board(at,words,heading=0){const g=rootAt(at,heading);prefab(g,'sign',[0,0,0],.82);sign(g,[0,1.36,.085],words,1.50,.36);return g;}
 function trailDistance(n){let best=1e3;for(const t of [...TRAILS,...DETOUR_TRAILS])for(let i=0;i<t.points.length-1;i++){const a=normalAt(...t.points[i]),b=normalAt(...t.points[i+1]);for(let j=0;j<=12;j++)best=Math.min(best,Math.acos(clamp(dot(n,slerp(a,b,j/12)),-1,1))*R);}return best;}
 for(const t of TRAILS){path(t.points,t.width+.18,'#b9aa8b',.040);path(t.points,t.width,t.color,.077);}
 // Town shops. The upper gallery is a through-route, not a painted window.
 const market=rootAt([17,26],Math.PI);patch([17,26],6.4,5.2,'#d7ccaa',.036);
 deck(market,0,0,10,6,.14,'market_ground');entry(market,{z:3,y:.14,width:2.4,id:'market_entry'});
 for(const [x,col,name] of [[-3,'#c18b73','SEED & THREAD'],[3,'#d1a37b','CRUMB BAKERY']]){
  box(market,col,[x,1.43,-1.68],[3.5,2.6,.16]);box(market,'#edd7b0',[x,1.7,-1.56],[1.42,1.18,.08]);box(market,sage,[x,1.7,-1.50],[1.18,.96,.07]);
  prefab(market,'shop_canopy',[x,.14,-.10],.91);solid(market,[x,.71,-.10],[2.90,1.24,1.1],'shop_counter');
  sign(market,[x,2.28,1.73],name,2.95,.43);prefab(market,'pot',[x-1.4,.15,1.7],.85);
 }
 prefab(market,'seed_packets',[-3,1.39,-.1],1.3);
 for(let i=0;i<4;i++)prefab(market,'bread',[2.17+i*.5,1.37,.15],.87);
 activity(market,'seed-shop','seeds',[-2.25,.16,1.25],'Take a seed packet');
 activity(market,'bakery','bakery',[2.25,.16,1.25],'Try a warm bun');
 const galleryY=3.08;deck(market,0,-.4,10,3.9,galleryY,'shop_gallery');
 for(const x of [-4.8,4.8])for(const z of [-2.22,1.37])rod(market,[x,surfaceY(x,z),z],[x,galleryY+.85,z],.085,wood);
 rail(market,[-4.9,galleryY+.8,-2.32],[4.9,galleryY+.8,-2.32]);rail(market,[-2.75,galleryY+.8,1.5],[2.75,galleryY+.8,1.5]);
 const marketWest=stairs(market,{x:-4,from:5.7,to:1.45,y:galleryY,id:'market_west'}),marketEast=stairs(market,{x:4,from:5.7,to:1.45,y:galleryY,id:'market_east'});
 sign(market,[0,4.0,-2.20],'THE ROOFTOP READING LANE',5.2,.55);prefab(market,'bench',[0,galleryY,-1.45]);prefab(market,'book',[.20,galleryY+.72,-1.38]);
 for(const x of [-2.3,2.3])prefab(market,'pot',[x,galleryY,-1.7],1.2);
 // A continuous back stair keeps the centre lane open on both sides of the shops.
 stairs(market,{x:0,from:-6.2,to:-3.02,y:.14,width:2.4,id:'market_rear'});
 w.routeChecks.push({id:'shop_gallery',points:[marketWest.entry,marketWest.top,point(market,-4,galleryY,-.3).n,point(market,0,galleryY,-.3).n,point(market,4,galleryY,-.3).n,marketEast.top,marketEast.entry],high:2});
 keeper(market,'fox',[3,.16,-1.35],Math.PI,'Baker Bramble');
 // The fields. Leave space in the centre for the player and the planted bed.
 patch([20,-20],7.2,5.9,'#c8c88a',.039);const fields=rootAt([20,-20]);
 for(const x of [-4.5,4.5])for(let z=-4;z<=4;z+=2){const g=onGround(fields,x,z);rod(g,[0,0,0],[0,.85,0],.045,wood);}
 for(const side of [-1,1])for(let row=0;row<4;row++)for(let col=0;col<7;col++){
  const g=onGround(fields,side*(1.8+row*.60),-3.3+col*.85);prefab(g,'grain',[0,0,0],.86+random()*.20);
 }
 const garden=dynamic([20,-20],0,'player_flower_bed');box(garden,'#947c60',[0,.055,0],[2.4,.1,2.8]);
 const flowers=[];for(let i=0;i<9;i++){const flower=prefab(garden,'flower',[(i%3-1)*.66,.15,(Math.floor(i/3)-1)*.74],1.35);flowers.push(flower);}
 activity(fields,'field-bed','plant',[0,.04,2.4],'Plant seeds in the empty bed');
 const millRoot=dynamic([24,-25],.35,'field_windmill'),mill=prefab(millRoot,'windmill');solid(millRoot,[0,1.8,0],[1.6,3.6,1.6],'windmill');
 sign(fields,[0,1.25,3.30],'SUNPATCH · PLANT SOMETHING',3.8,.55);for(const x of [-1.9,1.9])box(fields,wood,[x,.65,3.23],[.12,1.3,.12]);
 w.expansion.fields={flowers,mill:mill.find('sails')};
 // Open-air baths, a timber screen, warm water, and a working tap.
 const baths=rootAt([35,-16]);patch([35,-16],6.1,5.8,'#d4cdb1',.027);deck(baths,0,0,9.5,8,.15,'bath_deck');
 entry(baths,{z:4,y:.15,width:2.5,id:'bath_entry'});prefab(baths,'bath_pool',[0,.16,-.70]);solid(baths,[0,.40,-.70],[4.35,.68,3.6],'bath_pool');
 for(const x of [-4.3,4.3])for(const z of [-3.7,2.55])rod(baths,[x,.15,z],[x,3.6,z],.09,wood);
 for(let x=-4.4;x<=4.4;x+=.73)box(baths,wood,[x,3.65,-2.05],[.11,.14,3.65]);
 for(let x=-4.25;x<=4.3;x+=.33)box(baths,'#ba9c75',[x,1.13,-3.82],[.20,1.96,.08]);
 sign(baths,[0,2.68,3.27],'CLOUDWATER BATHS',4.4,.70);for(const x of [-2.3,2.3])rod(baths,[x,.15,3.3],[x,3.2,3.3],.07,wood);
 const tapRoot=dynamic([35,-16]),tap=prefab(tapRoot,'bath_tap',[-3.20,.16,.40]);
 activity(baths,'warm-tap','tap',[-3.1,.16,1.8],'Open the warm tap');activity(baths,'bath-rest','rest',[.15,.16,2.40],'Rest beside the pool');
 prefab(baths,'bench',[3.32,.16,-.9],1,Math.PI/2);for(let i=0;i<3;i++)box(baths,['#f7ecd0','#b8cabc','#eeddb7'][i],[3.6,.88+i*.09,-1.18],[.5,.08,.39]);
 keeper(baths,'frog',[-3.15,.16,-2.55],.2,'Bathkeeper Fern');
 const bathMist=dynamic([35,-16],0,'bath_steam');bathMist.transparent=true;const steam=[];
 for(let i=0;i<10;i++){const n=bathMist.part('bud','#f6efda',[0,0,0],[.1,.1,.1]);n.unlit=true;n.tint[3]=.12;steam.push(n);}
 w.expansion.baths={steam,tap:tap.find('tap_wheel')};
 // A pottery yard. Clay comes from the ridge, not from a delivery reward.
 patch([57,-15],6,5.3,'#d7b49c',.024);const kiln=rootAt([57,-15]);deck(kiln,0,0,8.8,7.5,.14,'kiln_yard');entry(kiln,{z:3.75,y:.14,width:2.5,id:'kiln_entry'});
 prefab(kiln,'kiln',[-2.0,.15,-1.6],1.10);solid(kiln,[-2,1.2,-1.6],[3.0,2.4,2.7],'kiln');prefab(kiln,'pottery_table',[1.6,.15,-.70]);solid(kiln,[1.6,.63,-.7],[2.6,1.18,1.12],'pottery_table');
 activity(kiln,'pottery-wheel','pottery',[1.6,.16,1.55],'Shape and fire a cup');sign(kiln,[0,2.95,2.38],'EMBER KILN · LITTLE THINGS, MADE HERE',6.3,.56);
 for(const x of [-3.5,3.5])rod(kiln,[x,.15,2.4],[x,3.30,2.4],.065,wood);
 for(let i=0;i<5;i++){const n=onGround(kiln,-4.3+random()*.3,-3+i*1.1);prefab(n,'ridge_stone',[0,0,0],.7);}
 const kilnAnim=dynamic([57,-15],0,'kiln_details'),madeCup=prefab(kilnAnim,'glazed_mug',[1.6,1.31,-.70],1.4),embers=kilnAnim.part('smooth','#efb267',[-2,.65,-.10],[.40,.13,.06]);embers.unlit=true;
 const smoke=[];for(let i=0;i<5;i++){const puff=kilnAnim.part('bud','#ddd3bd',[-2,4,0],[.15,.15,.15]);puff.transparent=true;puff.tint[3]=.17;smoke.push(puff);}
 keeper(kiln,'cat',[3.2,.16,-2.3],-.25,'Potter Ash');w.expansion.kiln={madeCup,embers,smoke};
 // The ridge has a bridge over a dry stone cleft. Both ends have real stairs.
 const ridge=rootAt([74,23]);patch([74,23],6.5,6.5,'#bdbbab',.027);
 for(const x of [-3.7,3.7])for(let i=0;i<5;i++){const g=onGround(ridge,x+random()*.8,-4.4+i*2.0);prefab(g,'ridge_stone',[0,0,0],1.25+random()*.40,random()*3);solid(g,[0,.5,0],[1.4,1,1.1],'ridge_rock');}
 deck(ridge,0,0,2.1,4.2,1.50,'ridge_bridge');rail(ridge,[-1.12,2.30,-2.0],[-1.12,2.30,2.0]);rail(ridge,[1.12,2.30,-2.0],[1.12,2.30,2.0]);
 const ridgeA=stairs(ridge,{x:0,from:6.1,to:2.03,y:1.50,width:2.1,id:'ridge_south'}),ridgeB=stairs(ridge,{x:0,from:-6.1,to:-2.03,y:1.50,width:2.1,id:'ridge_north'});
 const clayRoot=onGround(ridge,2.15,-5.85);prefab(clayRoot,'clay_basket');activity(clayRoot,'ridge-clay','clay',[0,0,1.05],'Take a small piece of clay');
 prefab(clayRoot,'sign',[0,0,-.7],.70);sign(clayRoot,[0,1.16,-.62],'A CUP STARTS HERE',1.26,.30);
 w.clayAccess=[ridgeB.entry,point(ridge,0,surfaceY(0,-7.2),-7.2).n,point(ridge,2.5,surfaceY(2.5,-7.2),-7.2).n,point(ridge,2.5,surfaceY(2.5,-5.1),-5.1).n];path(w.clayAccess.map(coordinates),1.5,'#dac7a0',.09);
 w.routeChecks.push({id:'ridge_bridge',points:[ridgeA.entry,ridgeA.top,point(ridge,0,1.5,0).n,ridgeB.top,ridgeB.entry],high:1.3});
 // Dense woodland with clear paths and three separate chime posts.
 patch([-36,-22],8.7,8.1,'#8fa78a',.02);const woods=rootAt([-36,-22]);
 for(let i=0;i<55;i++){const x=(random()-.5)*21,z=(random()-.5)*17,n=frameNormal(woods.matrix,x,z);if(trailDistance(n)<2.05)continue;const g=rootAt(coordinates(n),random()*6);prefab(g,i%3?'pine':'oak',[0,0,0],.79+random()*.43);solid(g,[0,1.2,0],[.37,2.4,.37],'woodland_tree');if(i%4===0)prefab(g,'mushroom',[.62,0,.45],.45);}
 w.expansion.chimes=[];
 for(const [i,at] of [[0,[-30,-20]],[1,[-35,-27]],[2,[-42,-21]]]){const g=dynamic(at,0,'forest_chime_'+i),node=prefab(g,'chime');activity(g,'forest-note-'+i,'chime',[.2,0,1],'Play woodland note '+(i+1),{note:i,node:node.find('swing')});sign(g,[0,1.07,.15],String(i+1),.31,.19);w.expansion.chimes.push(node.find('swing'));}
 board([-31,-16],'HUSHWOOD  ↙');
 // The treehouse: one stair up, an archive, a canopy bridge, and one stair down.
 const archive=rootAt([-60,-17]);const ay=3.72;
 deck(archive,-1.10,0,6,5.1,ay,'archive_floor');prefab(archive,'archive_hut',[-1.10,ay,0]);
 solid(archive,[-1.10,ay+1.15,-2.24],[5.4,2.3,.14],'archive_back');solid(archive,[-3.76,ay+.62,0],[.13,1.24,4.5],'archive_side');
 for(const x of [-3.55,-1.90,.4])prefab(archive,'archive_shelf',[x,ay,-1.70],.84);
 const archiveAnim=dynamic([-60,-17],0,'archive_details'),book=prefab(archiveAnim,'open_book',[-1.18,ay,.15],.87);
 activity(archive,'archive-book','read',[-1.18,ay,1.64],'Read the travel book');
 sign(archive,[-1.1,ay+2.48,2.10],'THE CANOPY ARCHIVE',4.5,.51);prefab(archive,'pot',[1.20,ay,1.75],.9);
 // The trunk and leaves sit behind the room so they do not hide the route.
 for(const [x,z]of [[-3.9,-2.5],[10.1,-3.5]]){
  archive.part('cylinder','#8d7760',[x,3.3,z],[.47,8.8,.47]);solid(archive,[x,3.0,z],[.76,8,.76],'archive_tree');
  for(const side of [-1,1])rod(archive,[x,.8,z],[x+side*1.25,-.4,z+.3],.20,'#8d7760');
  rod(archive,[x,4.9,z],[x-1.8,7.2,z-1],.22,'#8d7760');
  for(let i=0;i<4;i++)orb(archive,['#86a080','#9eb28b','#b1c296','#92aa82'][i],[x+(i%2-.5)*2.4,8.2+Math.floor(i/2)*.5,z-1.1+(Math.floor(i/2)-.5)*1.8],[2.25,1.18,1.8]);
 }
 const west=stairs(archive,{x:-1.6,from:8.9,to:2.48,y:ay,width:2.1,id:'archive_west'});
 const bridgePoints=bridge(archive,{x0:1.92,x1:6.85,z:.03,y:ay,width:1.8,id:'canopy_bridge'});
 deck(archive,8.27,0,3.2,5.1,ay,'canopy_east');const east=stairs(archive,{x:8.27,from:9.2,to:2.48,y:ay,width:2.1,id:'archive_east'});
 rail(archive,[6.68,ay+.8,-2.5],[7.08,ay+.8,-2.5]);rail(archive,[9.46,ay+.8,-2.5],[9.84,ay+.8,-2.5]);rail(archive,[9.9,ay+.8,-2.5],[9.9,ay+.8,2.50]);
 prefab(archive,'bench',[8.25,ay,-1.2]);sign(archive,[8.25,ay+1.55,-2.17],'TAKE THE LONG WAY DOWN',2.72,.46);
 for(const x of [-3.7,.9,7,9.5])prefab(archive,'lantern',[x,ay+.10,x<2?2.24:1.7],.8);
 w.routeChecks.push({id:'canopy_route',points:[west.entry,west.top,point(archive,-1.6,ay,.2).n,point(archive,1.60,ay,.1).n,...bridgePoints,point(archive,8.27,ay,.03).n,east.top,east.entry],high:3.5});
 // Wide connectors meet both stair feet on the forest loop.
 path([[-61,-5.4],coordinates(west.entry)],1.95,'#d8c39a',.08);path([[-51,-4.8],coordinates(east.entry)],1.95,'#d8c39a',.08);
 w.expansion.archive={book:book.find('turn_page')};
 // A tiny, open-roof cinema with actual seats, reels, and a live screen.
 const cinema=rootAt([-27,24],Math.PI);patch([-27,24],6.5,6.8,'#cfc1ab',.031);
 deck(cinema,0,0,9,9,.14,'cinema_floor');entry(cinema,{z:4.5,y:.14,width:2.5,id:'cinema_entry'});
 box(cinema,'#bea6a1',[0,2.35,-4.42],[9,4.45,.17]);solid(cinema,[0,2.35,-4.42],[9,4.45,.17],'cinema_back');
 for(const x of [-4.42,4.42]){box(cinema,'#ddc4ad',[x,1.3,0],[.16,2.35,9]);solid(cinema,[x,1.3,0],[.16,2.35,9],'cinema_side');}
 box(cinema,dark,[0,2.8,-4.22],[6.46,3.96,.20]);box(cinema,'#e9dfc7',[0,2.8,-4.08],[6.13,3.64,.05]);
 const screen=cinema.part('plane',cream,[0,2.8,-4.035],[5.86,3.32,1],[0,0,0],'cinema_screen');screen.unlit=true;screen.texture=w.renderer.textTexture('pocket-film','THE POCKET\nPICTUREHOUSE',{width:512,height:320,bg:'#efe3c4',color:'#435e55',size:32,line:55});
 for(const x of [-3.48,3.48]){box(cinema,'#ba7b71',[x,2.55,-4.0],[.75,4,.25]);for(let i=0;i<4;i++)box(cinema,'#a66e66',[x-.28+i*.19,2.55,-3.81],[.07,4.0,.13]);}
 for(let row=0;row<3;row++)for(const x of [-2.12,2.12]){const z=-1.43+row*1.35;prefab(cinema,'cinema_chair',[x,.17,z],1.12,Math.PI);solid(cinema,[x,.64,z],[.86,1.15,.83],'cinema_seat');}
 const projectorRoot=dynamic([-27,24],Math.PI,'cinema_reels'),projector=prefab(projectorRoot,'cinema_projector',[1.85,.16,3.17],.87,Math.PI);
 activity(cinema,'cinema-projector','film',[0,.16,2.90],'Play the film from the archive');
 box(cinema,'#c78271',[0,3.62,4.47],[9.5,.93,.52]);sign(cinema,[0,3.65,4.79],'THE POCKET PICTUREHOUSE',7.8,.60);box(cinema,'#e5bb87',[0,3.16,4.7],[9.5,.09,.85]);
 for(const x of [-4.38,4.38]){rod(cinema,[x,.14,4.40],[x,4.04,4.40],.13,wood);}
 for(let i=0;i<17;i++)cinema.part('bud','#f3dca3',[-4+i*.50,3.08,4.72],[.075,.075,.075]);
 // A signed lane around the cinema connects its front door to the north route.
 const detour=[[0,0,7],[-5.7,0,6],[-6,0,-3],[-5,0,-6],[0,0,-7]].map(p=>coordinates(norm(framePoint(cinema.matrix,p))));path(detour,1.7,'#dfceb0',.08);
 keeper(cinema,'rabbit',[-3.25,.16,3.30],Math.PI,'Usher Nib');
 w.expansion.cinema={frame:cinema.matrix,screen,reels:[projector.find('reel_0'),projector.find('reel_1')],watch:point(cinema,0,.16,2.50),eye:framePoint(cinema.matrix,[0,2.28,5.25]),target:framePoint(cinema.matrix,[0,2.8,-4.04])};
 // Route boards show destinations. There are no floating neighbor markers.
 for(const [at,words,heading] of [
  [[6,7],'FIELDS · BATHS  →',.25],[[21,-14],'BATHS · KILN  →',0],[[41,-8],'KILN  →',0],[[18,20],'SHOPS  ↑',0],
  [[-14,13],'POCKET CINEMA  ↖',-.3],[[-38,18],'POND  ←',0],[[-25,-12],'HUSHWOOD · ARCHIVE  ←',-.2],
  [[-53,-4.7],'ARCHIVE STAIRS  ↓',Math.PI],[[-68,0],'POND · BELL  ↑',0],[[65,8],'RIDGE · CLAY  ↑',0],[[75,18],'STONE BRIDGE  ↑',0]
 ])board(at,words,heading);
 // Lamp rewards change real world objects after the field notes are complete.
 const rewardLights=[];
 for(const at of [[-4.8,7],[5,16],[14,21],[22,-13],[37.3,-9],[55,-9],[-33,-15],[-54,-4.2],[-24,16.5],[67.5,14]]){
  const g=dynamic(at,0,'trail_lantern');rod(g,[0,0,0],[0,2.20,0],.055,wood);prefab(g,'lantern',[0,2.13,0],.72);const light=g.part('bud','#ffe0a0',[0,2.4,0],[.22,.25,.22]);light.unlit=true;light.visible=false;rewardLights.push(light);
 }
 w.expansion.rewardLights=rewardLights;
 w.expansion.update=(t,state,busy,filmPlaying)=>{
  const e=state.explore;
  for(const flower of flowers){flower.visible=e.has('fields');const age=t-(e.plantTime??-100);const grow=age>=0&&age<3?Math.max(.06,Math.min(1,age/3)):1;flower.scale=[1.35*grow,1.35*grow,1.35*grow];}
  w.expansion.fields.mill.rotation[2]=t*.23;
  w.expansion.baths.tap.rotation[2]=e.warm?Math.PI/2:0;
  for(let i=0;i<steam.length;i++){const f=(t*.20+i*.127)%1,n=steam[i];n.visible=e.warm;n.position=[Math.sin(i*2.2)*1.3,.78+f*2.3,-.7+Math.cos(i*1.8)*.8];const s=.08+f*.28;n.scale=[s,s*1.25,s];n.tint[3]=.13*(1-f);}
  madeCup.visible=e.has('kiln');embers.visible=!!busy&&busy.kind==='pottery';
  for(let i=0;i<smoke.length;i++){const n=smoke[i],f=(t*.24+i*.20)%1;n.visible=!!busy&&busy.kind==='pottery';n.position=[-2+f*.40,3.92+f*1.8,-1.9];const s=.08+f*.20;n.scale=[s,s,s];n.tint[3]=.22*(1-f);}
  for(const o of w.activities){if(o.kind==='chime')o.node.rotation[2]=t-o.lastUse<3?Math.sin((t-o.lastUse)*9)*.23*Math.exp(-(t-o.lastUse)):0;}
  const read=interactions.find(x=>x.id==='archive-book');book.find('turn_page').rotation[2]=t-read.lastUse<1?Math.sin((t-read.lastUse)*Math.PI)*.23:0;
  for(const reel of w.expansion.cinema.reels)if(filmPlaying)reel.rotation[2]=t*2.6;
  for(const lamp of rewardLights)lamp.visible=e.complete;
 };
}

export { addExpansion };
