import { Node } from './engine.js';
import { SUNROOM, SUNROOM_PATH } from './sunroom-spec.js';
import { placeBuilder } from './place-builder.js';
import { meshData, tri } from './geometry.js';
import { framePoint, normalAt } from './physics.js';
import { norm, len } from './math.js';

function addSunroom(w){
 const {rootAt,box,prefab,solid,rod,sign}=w;
 const {deck,stairs,point}=placeBuilder(w);
 const room=rootAt(SUNROOM.at,SUNROOM.heading);room.name='sunroom_studio';
 const y=SUNROOM.floor,size=SUNROOM.wallSize;
 const plaster='#e7bb8c',cream='#f6e6c8',sage='#8c9d80',wood='#ac825d';
 w.patch(SUNROOM.at,4.65,5.2,'#d6c69f',.053);
 w.path(SUNROOM_PATH,1.9,'#bdae90',.090);
 w.path(SUNROOM_PATH,1.7,'#eddbb8',.110);
 deck(room,0,0,6.30,6.25,y,'sunroom_floor','#ecd4ae');
 const entrance=stairs(room,{x:0,from:5.15,to:3.08,y,width:2.85,id:'sunroom_steps'});

 // The wall has five plaster faces and one painted face. There is no box
 // behind a floating poster, no frame, and no coplanar surface to flicker.
 const shell=meshData();
 const faces=[
  [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],
  [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],
  [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],
  [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]],
  [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]
 ];
 for(const [a,b,c,d] of faces){tri(shell,a,b,c);tri(shell,a,c,d);}
 w.renderer.register('sunroom_wall_shell',shell);
 const wall=new Node('sunroom_back_wall');
 wall.position=[0,y+.018+size/2,SUNROOM.wallZ];wall.scale=[size,size,.18];room.add(wall);
 wall.part('sunroom_wall_shell',plaster);
 const mural=wall.part('plane','#ffffff',[0,0,.5],[1,1,1],[0,0,0],'sunroom_mural_surface');
 mural.texture=SUNROOM.texture;mural.unlit=true;
 solid(room,wall.position,[size,size,.18],'sunroom_back_wall');

 // Low side walls and side glazing keep the back wall visible from the path.
 // The centre of the roof is cut away, as it is in the existing game rooms.
 for(const side of [-1,1]){
  const x=side*2.89;
  box(room,cream,[x,y+.38,-.05],[.18,.76,5.83]);
  solid(room,[x,y+.38,-.05],[.18,.76,5.83],'sunroom_side_wall');
  for(const z of [-2.78,-.72,1.34]){
   const top=5.50-(z+2.78)*.29;
   box(room,wood,[x,y+top/2,z],[.085,top,.085]);
  }
  rod(room,[x,y+5.50,-2.78],[x,y+4.31,1.34],.050,wood);
  for(const z of [-1.75,.31]){
   const pane=box(room,'#d3e0cb',[x,y+2.20,z],[.027,2.42,1.98]);
   pane.transparent=true;pane.tint[3]=.16;
   box(room,cream,[x,y+2.20,z],[.060,.050,1.98]);
   box(room,wood,[x,y+3.41,z],[.074,.064,1.98]);
  }
 }
 // A small work table stays at the side, below the sight line to the mural.
 box(room,wood,[1.96,y+.87,.56],[1.30,.12,1.06]);
 for(const x of [1.44,2.48])for(const z of [.16,.96])
  box(room,wood,[x,y+.42,z],[.085,.84,.085]);
 solid(room,[1.96,y+.43,.56],[1.30,.86,1.06],'sunroom_work_table');
 box(room,cream,[1.94,y+.947,.56],[.79,.020,.60]);
 for(const [i,c] of ['#879ccb','#c98771','#9eaf86'].entries()){
  room.part('cylinder',c,[1.63+i*.29,y+.99,.77],[.068,.057,.068]);
 }
 room.part('cup',sage,[2.36,y+1.08,.29],[.10,.24,.10]);
 for(let i=0;i<3;i++)rod(room,[2.34+i*.023,y+1.15,.29],[2.29+i*.055,y+1.47,.31],.012,wood);
 prefab(room,'stool',[1.96,y+.018,1.70],.82);
 prefab(room,'pot',[-2.33,y+.018,1.90],1.15);
 prefab(room,'pot',[2.35,y+.018,2.51],.78);
 const seat=prefab(room,'bench',[-1.8,y+.018,.20],.75,Math.PI/2);
 solid(room,[-1.8,y+.28,.20],[.65,.55,1.43],'sunroom_bench');

 // Text is on a separate direction board, never in the mural image.
 const board=rootAt([6.3,-3.4],-.12);
 prefab(board,'sign',[0,0,0],.75);
 sign(board,[0,1.25,.080],'SUNROOM STUDIO',1.36,.34);
 const tag=rootAt([-2.4,-8.8],.12);
 prefab(tag,'sign',[0,0,0],.72);
 sign(tag,[0,1.20,.080],'SUNROOM STUDIO',1.31,.33);
 const target=point(room,0,y+.018,-.43);
 w.interactions.push({id:'sunroom-mural',type:'mural',name:'Sunroom Studio',
  prompt:'Look at the mural',...target});
 const spawnPoint=framePoint(room.matrix,[0,y+.018,1.60]);
 const centre=framePoint(room.matrix,[0,y+.018+size/2,SUNROOM.wallZ+.09]);
 w.sunroom={root:room,backWall:wall,mural,texture:SUNROOM.texture,
  entry:entrance.entry,spawn:{n:norm(spawnPoint),h:len(spawnPoint)-26},
  view:{target:centre,front:[room.matrix[8],room.matrix[9],room.matrix[10]],
   up:[room.matrix[4],room.matrix[5],room.matrix[6]],size},
  path:SUNROOM_PATH};
}
export { addSunroom };
