/* Cinder Choir: authored wire boards. No DOM or engine dependencies.
 * A solution is any connected network that powers all receivers and no alarms.
 * Rotation drafts are saved by Adventure. Board solutions are guide data only. */
(() => {
'use strict';
const CC=globalThis.CC=globalThis.CC||{}, P={version:1,boards:{}};
const directions=[[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
P.rotate=(mask,turns)=>{for(let i=0;i<((turns%4)+4)%4;i++)mask=((mask<<1)&15)|(mask>>3);return mask;};
P.validDraft=(board,answer)=>!!board&&Array.isArray(answer)&&answer.length===board.w*board.h&&Array.from(answer).every(n=>Number.isInteger(n)&&n>=0&&n<4);
P.inspect=(boardOrId,answer)=>{
 const board=typeof boardOrId==='string'?P.boards[boardOrId]:boardOrId;
 if(!P.validDraft(board,answer))return {valid:false,success:false,powered:[],receivers:[],alarms:[],masks:[]};
 const masks=board.masks.map((mask,i)=>P.rotate(mask,answer[i])),powered=new Set([board.source]),queue=[board.source];
 for(let j=0;j<queue.length;j++){
  const i=queue[j],x=i%board.w,y=Math.floor(i/board.w);
  for(const [dx,dy,bit,opposite]of directions){
   const nx=x+dx,ny=y+dy,n=ny*board.w+nx;
   if(nx<0||nx>=board.w||ny<0||ny>=board.h||!(masks[i]&bit)||!(masks[n]&opposite)||powered.has(n))continue;
   powered.add(n);queue.push(n);
  }
 }
 const receivers=board.receivers.filter(i=>powered.has(i)),alarms=board.alarms.filter(i=>powered.has(i));
 return {valid:true,success:receivers.length===board.receivers.length&&!alarms.length,powered:[...powered],receivers,alarms,masks};
};
function board(id,w,h,paths,alarms,seed){
 const solved=Array(w*h).fill(0),used=new Set();
 for(const path of paths)for(let i=0;i<path.length;i++){
  const a=path[i];if(a<0||a>=w*h)throw Error(id+': cell outside board');used.add(a);
  if(!i)continue;const b=path[i-1],dx=a%w-b%w,dy=Math.floor(a/w)-Math.floor(b/w);
  const edge=directions.find(d=>d[0]===dx&&d[1]===dy);if(!edge)throw Error(id+': broken authored path');
  solved[b]|=edge[2];solved[a]|=edge[3];
 }
 if(alarms.some(i=>used.has(i)))throw Error(id+': alarm on intended route');
 const masks=solved.map((mask,i)=>P.rotate(mask||[3,5,6,9,10,12,7][(i+seed)%7],(i*i+i*seed+seed)%4));
 const solution=solved.map((_,i)=>(4-(i*i+i*seed+seed)%4)%4);
 const initial=solved.map((_,i)=>(i*3+Math.floor(i/w)+seed)%4);
 const b={id,w,h,masks,source:paths[0][0],receivers:[...new Set(paths.map(p=>p[p.length-1]))],alarms,initial,solution};
 if(!P.inspect(b,solution).success)throw Error(id+': invalid authored solution');
 if(P.inspect(b,initial).success){for(let i=0;i<initial.length;i++){initial[i]=(initial[i]+1)%4;if(!P.inspect(b,initial).success)break;}}
 P.boards[id]=b;
}
// Each path is authored in row order. Branches meet at shared cells.
board('c01',4,4,[[0,1,5,9,10,14,15]],[3,12],1);
board('c02',4,4,[[12,8,9,5,6,2,3],[9,10,11]],[0,14],2);
board('c03',4,4,[[3,2,6,10,9,13,12],[10,14,15]],[0,7],3);
board('c04',4,4,[[0,4,8,9,5,6,7,11,15],[6,2,3]],[12,14],4);
board('c05',5,4,[[0,1,6,11,12,13,8,9],[13,18,19]],[4,15],5);
board('c06',5,4,[[15,16,11,6,7,2,3,4],[11,12,17,18,19]],[0,14],6);
board('c07',5,5,[[4,3,8,13,12,17,22,21,20],[13,14,19,24]],[0,16],7);
board('c08',5,5,[[0,5,10,11,12,7,8,9,14,19,24],[12,17,22,23]],[4,20],8);
board('c09',4,4,[[12,8,4,5,6,10,11,7,3],[10,14,15]],[0,13],9);
board('c10',5,4,[[0,1,2,7,12,11,16,17,18,19],[12,13,8,9,4]],[5,15],10);
board('c11',5,5,[[20,15,16,17,12,7,6,1,2,3,4],[12,13,18,19,24]],[0,21],11);
board('c12',5,5,[[4,9,14,13,12,17,22,21,20],[12,11,6,1,0],[22,23,24]],[2,19],12);
board('c13',5,4,[[0,5,6,7,12,13,14,19],[7,8,3,4],[12,17,16,15]],[9,18],13);
board('c14',5,5,[[24,19,14,13,8,7,12,11,10,5,0],[7,2,1],[12,17,22,21,20]],[4,18],14);
board('c15',5,5,[[0,1,6,11,12,13,18,19,24],[12,17,22,21,20],[13,8,9,4]],[3,15],15);
board('c16',5,5,[[20,15,10,11,6,7,8,13,18,23,24],[8,3,4],[11,12,17,22,21]],[0,14],16);
P.get=id=>P.boards[id]||null;
CC.UndertidePuzzles=P;
})();
