// This new room uses the existing planet, paths, and collision system.
import { localDestination } from './detour-spec.js';
const SUNROOM={
 id:'sunroom',name:'Sunroom Studio',sub:'A small room for a shared morning.',
 at:[0,-14],radius:5.8,heading:0,floor:.16,wallSize:5.6,wallZ:-2.93,
 texture:'sunroom_morning_mural',imageWidth:1254,imageHeight:1254
};
const entryY=Math.sqrt(26*26-5.15*5.15)-26;
const SUNROOM_ENTRY=localDestination(SUNROOM.at,0,5.15,0,entryY);
const SUNROOM_PATH=[[6,6],[6,1],[4.8,-3.7],[1.8,-6.5],SUNROOM_ENTRY];
export { SUNROOM, SUNROOM_ENTRY, SUNROOM_PATH };
