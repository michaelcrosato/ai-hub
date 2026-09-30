/** Open Doors: layout data, independent activities, and connected route anchors.
 * Do not change the planet radius here without changing CONFIG.radius too. */
import { localFrame, norm, transform } from './math.js';
const R=26;
function localDestination(at,x,z,heading=0,y=0){
 const n=[Math.sin(at[0]/R)*Math.cos(at[1]/R),Math.cos(at[0]/R)*Math.cos(at[1]/R),Math.sin(at[1]/R)];
 const m=localFrame(n,heading);m[12]=n[0]*R;m[13]=n[1]*R;m[14]=n[2]*R;
 const q=norm(transform(m,[x,y,z]));return [Math.atan2(q[0],q[1])*R,Math.asin(Math.max(-1,Math.min(1,q[2])))*R];
}
const DETOUR_PLACES=[
 {id:'court',name:'Coppercap Court',sub:'Two open shops. A lane above the lane.',at:[44,26],radius:8},
 {id:'glasshouse',name:'Fernlight Glasshouse',sub:'A garden on the quiet side of the fields.',at:[1,-32],radius:6.4},
 {id:'crossing',name:'Tumbledown Crossing',sub:'Follow the stream under the stone arch.',at:[45,-30],radius:7}
];
const groundDestination=(at,x,z,heading=0)=>localDestination(at,x,z,heading,Math.sqrt(Math.max(1,R*R-x*x-z*z))-R);
const DOORS={
 courtFront:groundDestination([44,26],0,7.4,Math.PI),courtBack:groundDestination([44,26],0,-7.4,Math.PI),
 glassFront:groundDestination([1,-32],0,5.6),glassBack:groundDestination([1,-32],0,-5.6),
 stoneFront:groundDestination([45,-30],0,6.9),stoneBack:groundDestination([45,-30],0,-8.0),
 bathFront:groundDestination([35,-16],6.8,7.2),bathBack:groundDestination([35,-16],6.8,-7.2),
 kilnFront:groundDestination([57,-15],5.7,7.2),kilnBack:groundDestination([57,-15],5.7,-7.2),
 archiveBack:groundDestination([-60,-17],3.75,-6.1),
 cinemaLeft:groundDestination([-27,24],-5.7,9.05,Math.PI),cinemaRight:groundDestination([-27,24],5.7,9.05,Math.PI)
};
const DETOUR_TRAILS=[
 {id:'upper-town',name:'The upper town loop',color:'#e4c79f',width:2.05,points:[[17,33],[28,35],[38,35],DOORS.courtBack,[53,34],[62,33],[74,30.5]]},
 {id:'court-lane',color:'#edd6b4',width:2.2,points:[DOORS.courtFront,[44,26],DOORS.courtBack]},
 {id:'orchard-court',color:'#e5cb9f',width:1.9,points:[[56,4],[53,10],[49,15],DOORS.courtFront]},
 {id:'field-greenway',name:'The quiet fields',color:'#d1c496',width:1.75,points:[[-6,-26],groundDestination([1,-32],-3.4,5.8),DOORS.glassFront,groundDestination([1,-32],3.4,5.8),[21,-25],[20,-15]]},
 {id:'greenhouse-aisle',color:'#dbc99f',width:1.5,points:[DOORS.glassFront,[1,-32],DOORS.glassBack]},
 {id:'greenhouse-return',color:'#d1c496',width:1.65,points:[DOORS.glassBack,groundDestination([1,-32],3.8,-6.1),[29,-32],[21,-28],[21,-25]]},
 {id:'mineral-way',name:'The mineral walk',color:'#c7bdab',width:1.85,points:[[21,-25],[21,-28],[29,-28],[35,-25],groundDestination([45,-30],-2.9,7.1),DOORS.stoneFront]},
 {id:'stone-walk',color:'#c9bda6',width:1.85,points:[DOORS.stoneFront,[45,-30],DOORS.stoneBack]},
 {id:'stone-return',color:'#c7bdab',width:1.8,points:[DOORS.stoneBack,groundDestination([45,-30],0,-9.4),[68,-33],[72,-26],[72,-18],[68,-10],[65,7]]},
 {id:'bath-front-link',color:'#ead9b6',width:1.65,points:[[44,-7],DOORS.bathFront]},
 {id:'bath-back-link',color:'#dac7a6',width:1.65,points:[DOORS.bathBack,DOORS.stoneFront]},
 {id:'kiln-front-link',color:'#d6b69b',width:1.65,points:[[59,-4],DOORS.kilnFront]},
 {id:'kiln-back-link',color:'#cdb69f',width:1.7,points:[DOORS.kilnBack,groundDestination([57,-15],5.7,-8.8),[72,-18]]},
 {id:'fern-return',name:'The fern path',color:'#bbc29b',width:1.7,points:[DOORS.archiveBack,groundDestination([-60,-17],5.7,-5.8),groundDestination([-60,-17],6.0,-13.7),[-45,-29],[-41,-24]]},
 {id:'cinema-balcony-approach',color:'#e4d0b4',width:1.7,points:[DOORS.cinemaLeft,[-27,16],DOORS.cinemaRight]}
];
const DETOURS=[
 {id:'postcard',site:'court',name:'A letter from a little world',where:'Letter & Lantern · upper floor',hint:'Cross the shop bridge. Press a postcard upstairs.',prompt:'Press a little postcard',voice:'archive'},
 {id:'orrery',site:'court',name:'A world you can turn',where:'Turn & Tinker · ground floor',hint:'Wind the small planet in the toy shop. Watch its moon.',prompt:'Wind the toy planet',voice:'sprig'},
 {id:'greenhouse',site:'glasshouse',name:'A garden behind the fields',where:'Fernlight Glasshouse',hint:'Use the pump. Water the seed pods beside the open aisle.',prompt:'Water the glasshouse',voice:'sprig'},
 {id:'leafboat',site:'baths',name:'A leaf on warm water',where:'Cloudwater · upper terrace',hint:'Climb the outside stairs. Float a leaf in the small basin.',prompt:'Float a leaf boat',voice:'baths'},
 {id:'glaze',site:'kiln',name:'A color for the wall',where:'Ember Kiln · drying loft',hint:'Use the glaze table upstairs. Press E again to change the color.',prompt:'Paint a tile · change its color',voice:'kiln'},
 {id:'fernprint',site:'archive',name:'A page from the trees',where:'Canopy Archive · fern room',hint:'At the east tree deck, keep climbing. Cross the new bridge to the fern press.',prompt:'Make a fern print',voice:'archive'},
 {id:'shadowplay',site:'cinema',name:'The picture before the picture',where:'Pocket Picturehouse · balcony',hint:'Climb the outside stairs. Turn the small shadow theatre.',prompt:'Turn the shadow theatre',voice:'usher'},
 {id:'cairn',site:'crossing',name:'One stone at a time',where:'Tumbledown · bridge lookout',hint:'Cross the stone arch. Stack the three smooth stones on the side platform.',prompt:'Balance another stone',voice:'pebble'}
];
const GLAZES=['#83aba3','#d99880','#d6ba78'];
const DETOUR_WALKS=[
 {name:'Shops above the orchard',text:'Orchard → Coppercap Court → upper town → Thread & Crumb. Two shops, two floors, and a bridge.'},
 {name:'Fields to warm stones',text:'Fields → glasshouse → stone arch → kiln loft → baths terrace. Both terraces have stairs at each end.'},
 {name:'The high woodland route',text:'Pond → archive stairs → canopy bridge → fern room → woodland. The rear stairs return to the ground.'},
 {name:'Upstairs at the pictures',text:'Town square → cinema → outside stairs → projection balcony. The three films still play downstairs.'}
];

export { localDestination, DETOUR_PLACES, DOORS, DETOUR_TRAILS, DETOURS, GLAZES, DETOUR_WALKS };
