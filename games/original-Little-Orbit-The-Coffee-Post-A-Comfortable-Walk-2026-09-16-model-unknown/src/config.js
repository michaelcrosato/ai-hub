import { SUNROOM } from './sunroom-spec.js';
import { DETOUR_PLACES } from './detour-spec.js';
import { NEW_REGIONS } from './expansion-spec.js';
const CONFIG={radius:26,walkSpeed:3.6,runSpeed:6.4,gravity:16,jumpSpeed:5.1,stepHeight:.33,capacity:4,interactDistance:2.25,seed:1409,saveVersion:1};
const NEIGHBORS=[
 {id:'pip',name:'Pip',pet:'fox',place:'Button Square',at:[-2.2,15.4],heading:2.5,hint:'Listen for the fountain in the town square.',line:'A warm cup! Now I can finish sorting my very important leaves.',after:'One perfect coffee is plenty. Miso is reading above the lane.'},
 {id:'miso',name:'Miso',pet:'cat',place:'Skybridge Library',at:[13,9],local:[-3,-1],height:3.34,heading:2.6,hint:'A quiet reader has a room above the town. Find the stairs.',line:'You climbed all this way for me? Take the bridge. The view is worth it.',after:'Thank you again. Mochi likes the trees with orange fruit.'},
 {id:'mochi',name:'Mochi',pet:'rabbit',place:'Apricot Orchard',at:[40,5],heading:1.4,hint:'Follow the warm-colored path past the last house.',line:'The trees heard you coming. They saved their best fruit for you.',after:'Try a gentle shake of the old apricot tree.'},
 {id:'pebble',name:'Pebble',pet:'frog',place:'Lily Pond',at:[-48,8],heading:-1.1,hint:'Take the path through the pines. Look for still blue water.',line:'I was counting ripples. This is much better than counting ripples.',after:'My paper boat needs a little push. Will you help?'}
];
const REGIONS=[
 {id:'cafe',name:'Little Orbit Café',sub:'The start of every good round.',at:[0,0],radius:6},
 {id:'square',name:'Button Square',sub:'Small houses. A very small fountain.',at:[-1,13],radius:6},
 {id:'library',name:'Skybridge Library',sub:'Take the long way up.',at:[13,9],radius:9},
 {id:'orchard',name:'Apricot Orchard',sub:'A little farther from the busy lane.',at:[40,5],radius:9},
 {id:'pond',name:'Lily Pond',sub:'A place to slow down.',at:[-48,8],radius:8},
 {id:'meadow',name:'Moonflower Meadow',sub:'Something small is growing here.',at:[-22,-7],radius:7},
 {id:'bellhill',name:'Wind Bell Hill',sub:'You made it to the other side.',at:[79,5],radius:9},
 {...SUNROOM},...NEW_REGIONS,...DETOUR_PLACES
];
const MAIN_PATH=[[0,4],[-3.6,8],[-3.7,12],[-2.8,15.4],[1.8,16.5],[6.6,17],[8,19],[15,18.3],[22,18.3],[25,18.3],[28.5,16.5],[27,10],[40,5],[56,4],[79,5],[-70,8],[-48,8],[-35,3],[-22,-7],[-9,-3],[-8,4.7],[-4,6],[0,4]];

export { CONFIG, NEIGHBORS, REGIONS, MAIN_PATH };
