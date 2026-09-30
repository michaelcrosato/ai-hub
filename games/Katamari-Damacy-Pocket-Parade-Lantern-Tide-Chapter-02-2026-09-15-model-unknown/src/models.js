// Pocket Parade: Lantern Tide. The little things: every item in the market, the seed
// ball, the little pusher, the festival props, and the item portraits for the HUD and
// the collection. Models are pure vertex data (see geometry.js); render.js draws them.
import { Builder, G, initGeometry, cylinder, beam, Q, V, PI, TAU, clamp } from './geometry.js';

export const P = {};
/** Item ids in the order they were defined: the order of the collection catalogue. */
export const ORDER = [];
/** The meshes that are not items: seed ball, pusher parts, festival props. */
export const MESH = { sparks: [] };
export const colors = { ink: '#284941', cream: '#fff2c9', pink: '#f092a4', red: '#ea7361', mint: '#75b69a', lime: '#cbd873', teal: '#568e87', yellow: '#efc963', blue: '#80aab2', brown: '#ae7954', dark: '#805b44' };

function define(id, name, need, volume, radius, height, group, note, build, opts) {
  const b = new Builder();
  build(b);
  b.shift(0, -height / 2, 0);
  P[id] = { id, name, need, volume, radius, height, group, note, mesh: b.build(opts) };
  ORDER.push(id);
  return P[id];
}

let ready = false;
export function initModels() {
  if (ready) return;
  ready = true;
  initGeometry();
  initRoomModels();
  initFestivalModels();
  initTideModels();
}

// Chapter 01 things that came along to the market.
function initRoomModels() {
const C = colors;
define('coin','Lucky coin',10,.019,.22,.065,'bits','A small bit of good luck.',b=>{b.cyl('#dda83e',[0,.03,0],.21,.21,.06,[],14).cyl('#f9d77d',[0,.065,0],.16,.16,.015,[],14).ring('#c89535',[0,.076,0],.11,.012,[PI/2,0,0],14).box('#d09c3b',[0,.087,0],[.035,.009,.11]);});
define('button','Pink button',10,.021,.23,.075,'bits','One button. No shirt.',b=>{b.cyl(C.pink,[0,.034,0],.215,.215,.07,[],14).cyl('#efbbbd',[0,.072,0],.17,.17,.013,[],14);for(let x of[-1,1])for(let z of[-1,1])b.cyl('#a25d76',[x*.059,.082,z*.059],.023,.023,.012,[],8);});
define('candy','Lemon candy',12,.032,.4,.32,'snacks','Sweet little space food.',b=>{b.sphere('#efb954',[0,.16,0],[.24,.155,.16]).cyl('#f7d989',[-.29,.16,0],.15,.06,.18,[0,0,PI/2],6).cyl('#f7d989',[.29,.16,0],.06,.15,.18,[0,0,PI/2],6).box('#fff0d0',[0,.312,0],[.12,.016,.13]).box('#f1e4b6',[-.06,.16,.154],[.08,.23,.012]);});
define('pencil','Short pencil',12,.023,.67,.17,'bits','A bright idea in yellow.',b=>{b.cyl('#edbd52',[0,.09,0],.075,.075,1,[0,0,PI/2],6).cyl('#dab68a',[.61,.09,0],0,.075,.22,[0,0,-PI/2],6).cyl('#334c46',[.73,.09,0],0,.028,.08,[0,0,-PI/2],6).cyl('#ef97aa',[-.57,.09,0],.078,.078,.18,[0,0,PI/2],6).cyl('#b8c7b6',[-.46,.09,0],.08,.08,.07,[0,0,PI/2],8);});
define('eraser','Two-tone eraser',13,.034,.32,.23,'bits','Mistakes? What mistakes?',b=>{b.box('#ed8b91',[-.14,.115,0],[.29,.23,.28]).box('#81b3b3',[.14,.115,0],[.27,.23,.28]).box('#edead9',[.035,.116,0],[.075,.239,.286]);});
define('die','Lucky die',13,.052,.29,.43,'toys','Every side is a good side.',b=>{b.box('#fff0ce',[0,.215,0],[.43,.43,.43]);for(let x of[-1,1])for(let y of[-1,1])b.sphere(C.ink,[x*.1,.215+y*.1,.218],[.033,.033,.011]);b.sphere(C.red,[0,.215,.221],[.045,.045,.011]);for(let x of[-1,0,1])b.sphere(C.ink,[x*.105,.434,x*.105],[.027,.009,.027]);b.sphere(C.ink,[.219,.215,0],[.012,.04,.04]);});
define('cookie','Choc-chip cookie',14,.066,.33,.16,'snacks','The crumbs come with it.',b=>{b.cyl('#c58f53',[0,.071,0],.30,.315,.14,[],12).cyl('#dbac64',[0,.145,0],.265,.28,.04,[],12);for(let i=0;i<6;i++){let a=i*2.4,r=.06+(i%3)*.075;b.sphere('#765142',[Math.cos(a)*r,.17,Math.sin(a)*r],[.038,.021,.033])}});
define('berry','Strawberry',14,.070,.3,.64,'snacks','A tiny taste of summer.',b=>{b.sphere('#df6e69',[0,.29,0],[.28,.32,.26]);for(let i=0;i<5;i++){let a=i/5*TAU;b.sphere('#639b68',[Math.sin(a)*.105,.57,Math.cos(a)*.105],[.075,.027,.14],[0,a,0])}for(let i=0;i<12;i++){let a=i*2.4,y=.13+(i%3)*.13,r=.24-Math.abs(y-.29)*.25;b.sphere('#ffe0a0',[Math.cos(a)*r,y,Math.sin(a)*r],[.018,.027,.015])}});
define('spool','Thread spool',16,.093,.29,.55,'bits','A loose end, all tied up.',b=>{b.cyl('#eadbb5',[0,.05,0],.27,.27,.075,[],12).cyl('#efdfb8',[0,.5,0],.27,.27,.075,[],12).cyl('#85b7a1',[0,.275,0],.215,.215,.42,[],12);for(let y=.12;y<.5;y+=.075)b.ring('#699f8e',[0,y,0],.211,.012,[PI/2,0,0],12);b.cyl('#736854',[0,.546,0],.061,.061,.014,[],10);});
define('sushi','Salmon sushi',17,.115,.38,.45,'snacks','A very small lunch.',b=>{b.box('#f3edd3',[0,.16,0],[.62,.32,.4]).box('#e9937d',[0,.39,0],[.68,.15,.43]);for(let x of[-.22,-.075,.075,.22])b.box('#f8c7a0',[x,.47,0],[.027,.009,.44],[0,-.18,0]);b.box('#e3dbbd',[0,.045,.204],[.54,.026,.009]);});
for(let j=0;j<3;j++)define('block'+j,['A block','B block','C block'][j],19,.185,.47,.67,'toys','One piece of a bigger world.',b=>{let c=[C.red,C.blue,C.yellow][j];b.box(c,[0,.335,0],[.67,.67,.67]);b.box('#efe9cb',[0,.335,.339],[.49,.49,.014]);if(j===0){b.box(c,[-.09,.345,.352],[.065,.32,.015],[0,0,-.32]).box(c,[.09,.345,.352],[.065,.32,.015],[0,0,.32]).box(c,[0,.32,.353],[.2,.06,.017]);}else if(j===1){b.box(c,[-.105,.335,.352],[.055,.31,.018]);b.ring(c,[0,.41,.355],.079,.027,[],10).ring(c,[0,.268,.355],.083,.027,[],10)}else{b.ring(c,[0,.335,.352],.12,.03,[],12).box('#efe9cb',[.115,.336,.385],[.11,.1,.05])}b.box('#f1e6c6',[0,.676,0],[.42,.01,.42]);});
define('orange','Little orange',20,.27,.45,.92,'snacks','Fresh from a tiny sun.',b=>{b.sphere('#e7a44f',[0,.45,0],.44).cyl('#856449',[0,.893,0],.035,.045,.09,[],7).sphere('#78a275',[.115,.91,0],[.15,.025,.075],[0,0,-.18]);});
define('mug','Tea cup',22,.33,.59,.79,'home','Tea for the whole galaxy.',b=>{b.cyl('#f0e6c7',[0,.37,0],.36,.29,.69,[],14).cyl('#bfc9a5',[0,.19,0],.315,.3,.19,[],14).ring('#efdfb7',[.41,.41,0],.225,.065,[],14).cyl('#bd9a68',[0,.711,0],.285,.285,.013,[],14).ring('#fff0ce',[0,.719,0],.326,.035,[PI/2,0,0],14);});
define('can','Peach soda',23,.30,.33,.94,'snacks','A little fizz for the stars.',b=>{b.cyl('#86aaa8',[0,.45,0],.30,.30,.83,[],14).cyl('#efdfb9',[0,.42,0],.303,.303,.34,[],14).cyl('#c7cdbc',[0,.89,0],.28,.29,.06,[],14).cyl('#bbc3b5',[0,.025,0],.28,.28,.05,[],14).sphere('#e39c7e',[0,.45,.305],[.13,.14,.017]).cyl('#667f72',[0,.927,0],.078,.078,.011,[],10).box('#dfe4d0',[0,.944,0],[.065,.019,.14]);});
define('duck','Bath duck',24,.38,.55,.9,'toys','Ready for a space bath.',b=>{b.sphere('#edc559',[0,.29,0],[.44,.28,.34]).sphere('#f1d16b',[0,.65,.17],.24).sphere('#f6d87c',[-.34,.37,0],[.13,.18,.23],[0,0,-.2]).sphere('#f6d87c',[.34,.37,0],[.13,.18,.23],[0,0,.2]).box('#e79b4c',[0,.59,.395],[.28,.087,.23]).sphere(C.ink,[-.16,.704,.321],[.031,.04,.025]).sphere(C.ink,[.16,.704,.321],[.031,.04,.025]).cyl('#e7b651',[0,.41,-.3],0,.14,.33,[-.6,0,0],7);});
define('car','Toy car',25,.42,.66,.69,'toys','Beep beep. Make some room.',b=>{b.box('#dc776d',[0,.275,0],[1.03,.3,.51]).box('#70a4a4',[-.06,.49,0],[.57,.25,.445]).box('#c8ddd1',[-.06,.63,0],[.57,.025,.35]).box('#d9e7d2',[-.07,.485,.23],[.36,.16,.015]).box('#e8e4b8',[.522,.31,.145],[.014,.095,.1]).box('#e8e4b8',[.522,.31,-.145],[.014,.095,.1]);for(let x of[-.33,.33])for(let z of[-.29,.29]){b.cyl('#435d58',[x,.185,z],.18,.18,.105,[PI/2,0,0],10).cyl('#d0d9bf',[x,.185,z*1.2],.085,.085,.018,[PI/2,0,0],10)}});
define('book','Pocket storybook',25,.39,.77,.27,'home','A story worth keeping.',b=>{b.box('#da7a76',[0,.025,0],[.94,.05,1.14]).box('#f3e7c6',[.025,.132,0],[.85,.17,1.055]).box('#d76f6d',[0,.24,0],[.95,.055,1.14]).box('#c06866',[-.445,.136,0],[.065,.25,1.14]).box('#f1c678',[.02,.271,0],[.62,.012,.64]).star('#dc8c6a',[.015,.285,.01],.4,[PI/2,0,.18]);for(let y of[.075,.12,.16,.195])b.box('#cebea1',[.448,y,0],[.009,.009,1.0]);});
define('ball','Striped ball',26,.53,.53,1.05,'toys','A ball for your ball.',b=>{for(let i=0;i<G.sphere.length;i+=24){let cx=G.sphere[i]+G.sphere[i+8]+G.sphere[i+16],col=cx>.9?'#e8c865':cx<-.9?'#83b6a4':'#e6939b';b.part(G.sphere.slice(i,i+24),col,[0,.525,0],[.52,.52,.52]);}b.ring('#f4e4bb',[0,.525,0],.522,.017,[PI/2,0,0],16);});
define('carton','Milk carton',28,.59,.48,1.27,'snacks','Moon milk. Still fresh.',b=>{b.box('#a2c5af',[0,.45,0],[.63,.90,.62]).box('#f4edce',[0,.62,.318],[.46,.32,.015]).box('#e4ad76',[0,.64,.332],[.24,.16,.018]).box('#ecdfba',[0,1.018,-.17],[.635,.07,.43],[.65,0,0]).box('#f4e9c9',[0,1.018,.17],[.635,.07,.43],[-.65,0,0]).box('#89af9a',[0,1.19,0],[.65,.13,.06]).box('#f2e6c7',[0,.15,.315],[.63,.08,.014]);});
define('robot','Wind-up robot',30,.73,.61,1.39,'toys','Finally, a lift home.',b=>{b.box('#74aaa0',[0,.65,0],[.6,.62,.42]).box('#c2d5b3',[0,1.13,0],[.62,.4,.43]).box('#f4dfb0',[0,1.13,.225],[.46,.23,.025]);for(let x of[-.13,.13])b.box('#38594d',[x,1.16,.245],[.072,.07,.028]);b.box('#d48475',[0,1.035,.245],[.16,.025,.029]).cyl('#cf9f60',[0,1.38,0],.055,.06,.15,[],7).sphere('#e17c76',[0,1.47,0],.09);for(let x of[-1,1]){b.box('#96b89f',[x*.42,.65,0],[.17,.39,.2],[0,0,x*.15]).box('#b2c599',[x*.18,.225,0],[.15,.26,.17]).box('#d28077',[x*.18,.067,.055],[.28,.135,.3]);}b.ring('#efd091',[0,.65,.217],.14,.035,[],12).box('#e4b466',[0,.65,.235],[.09,.09,.025]);});
define('slipper','Cozy slipper',30,.65,.74,.45,'home','One small, warm step.',b=>{b.sphere('#e6cc8e',[0,.095,0],[.39,.10,.72]).sphere('#bd9471',[0,.17,.21],[.285,.018,.41]).sphere('#adbf92',[0,.23,-.21],[.38,.22,.48]).box('#cdd2a1',[0,.375,-.01],[.62,.058,.23],[-.3,0,0]);});
define('clock','Wake-up clock',34,1.03,.79,1.60,'home','There is always time to roll.',b=>{b.cyl('#d8827a',[0,.78,0],.64,.64,.29,[PI/2,0,0],18).cyl('#efdfb7',[0,.78,.16],.55,.55,.024,[PI/2,0,0],18);for(let i=0;i<12;i++){let a=i/12*TAU;b.box('#49675a',[Math.sin(a)*.456,.78+Math.cos(a)*.456,.18],[.035,.066,.012],[0,0,-a]);}b.box('#335b4f',[-.11,.83,.20],[.29,.035,.018],[0,0,-.4]).box('#335b4f',[0,.92,.21],[.038,.30,.02]).sphere('#d08c63',[0,.78,.23],.052);for(let x of[-1,1]){b.sphere('#d7867e',[x*.43,1.36,0],[.28,.17,.24],[0,0,-x*.4]).box('#617d69',[x*.37,.19,0],[.11,.32,.14],[0,0,-x*.3]);}b.ring('#899f83',[0,1.34,0],.18,.027,[],12);});
define('teapot','Polka-dot teapot',35,1.17,.96,1.53,'home','Pour a cup for the moon.',b=>{b.sphere('#b7c59c',[0,.66,0],[.63,.59,.56]).ring('#789879',[-.63,.78,0],.43,.095,[],14).cyl('#adb98e',[.62,.92,0],.12,.25,.73,[0,0,-.65],10).cyl('#d9d6a5',[0,1.16,0],.41,.47,.12,[],14).sphere('#cc8d74',[0,1.31,0],[.14,.11,.14]);for(let x of[-.29,0,.29])b.sphere('#f4e4c0',[x,.72,.53],[.064,.065,.015]);});
define('teddy','Little bear',36,1.48,.81,2.02,'toys','A very good hug.',b=>{b.sphere('#c18e63',[0,.72,0],[.51,.60,.4]).sphere('#c9996e',[0,1.43,0],[.48,.46,.39]).sphere('#e4c394',[0,1.30,.33],[.30,.21,.12]).sphere('#7c6148',[0,1.35,.433],[.082,.061,.038]);for(let x of[-1,1]){b.sphere('#c19168',[x*.40,1.8,0],[.19,.20,.14]).sphere('#deb589',[x*.40,1.80,.13],[.11,.12,.015]).sphere('#37574d',[x*.17,1.49,.352],[.043,.053,.019]).sphere('#bd875d',[x*.53,.82,0],[.24,.34,.23],[0,0,x*.35]).sphere('#b98257',[x*.32,.2,.2],[.25,.2,.31]).sphere('#e4bc8e',[x*.32,.23,.46],[.17,.10,.035]);}b.cyl('#d8817a',[-.14,1.03,.39],.14,0,.25,[0,0,PI/2],5).cyl('#d8817a',[.14,1.03,.39],0,.14,.25,[0,0,PI/2],5).sphere('#d36e6d',[0,1.03,.44],.083);});
define('plant','Pocket plant',37,1.32,.69,1.80,'home','A little green goes a long way.',b=>{b.cyl('#c29175',[0,.31,0],.48,.34,.61,[],10).cyl('#d8aa86',[0,.58,0],.51,.49,.14,[],10).cyl('#705e46',[0,.66,0],.435,.435,.018,[],10).cyl('#5c9167',[0,1.06,0],.035,.048,.85,[],7);for(let i=0;i<7;i++){let a=i*2.4,y=.79+i*.115;b.sphere(i%2?'#75a16f':'#93b282',[Math.sin(a)*.23,y,Math.cos(a)*.23],[.15,.07,.38],[.2,a,-.26])}b.sphere('#8bb178',[0,1.64,0],[.13,.18,.085],[0,0,-.2]);});
define('pillow','Flower cushion',40,1.9,1.12,.6,'home','Soft landings, everywhere.',b=>{b.sphere('#be9dab',[0,.26,0],[1.00,.27,.83]).box('#dac0bf',[0,.30,0],[1.83,.11,1.45]);for(let i=0;i<6;i++){let a=i/6*TAU;b.sphere('#e9c1aa',[Math.sin(a)*.25,.549,Math.cos(a)*.25],[.17,.017,.17]);}b.cyl('#cf9c6f',[0,.578,0],.16,.16,.018,[],10);b.box('#927989',[0,.29,.786],[1.60,.02,.022]);});
define('biscuits','Biscuit box',42,2.15,.94,1.85,'snacks','The whole box? Excellent.',b=>{b.box('#b6c698',[0,.92,0],[1.3,1.84,.62]).box('#e7dfb9',[0,.96,.322],[1.10,1.1,.019]).cyl('#d29867',[0,.97,.343],.34,.34,.014,[PI/2,0,0],12).ring('#f3daa0',[0,.97,.361],.26,.022,[],12).box('#778e68',[0,1.66,.322],[1.30,.14,.022]).box('#f1e4bf',[0,1.84,0],[1.25,.015,.52]).box('#759373',[0,.28,.322],[.8,.07,.02]);});
define('plate','Tea plate',29,.45,.87,.15,'home','Small plates. Big plans.',b=>{b.cyl('#e6dbbe',[0,.07,0],.84,.67,.13,[],20).cyl('#f2e8cb',[0,.14,0],.63,.63,.018,[],20).ring('#83ab9a',[0,.155,0],.72,.025,[PI/2,0,0],20);});
define('wish','Golden wish',12,.16,.45,.94,'wishes','A lost wish, found at last.',b=>{b.star('#e8bb61',[0,.47,0],.94).sphere(C.ink,[-.103,.48,.092],[.025,.035,.015]).sphere(C.ink,[.103,.48,.092],[.025,.035,.015]).sphere('#ef9b83',[-.2,.4,.095],[.044,.025,.008]).sphere('#ef9b83',[.2,.4,.095],[.044,.025,.008]).box('#8d7848',[0,.386,.096],[.07,.018,.01]);});
define('cat','The room inspector',55,4.75,1.56,2.61,'toys','The cat is in the bag. Sort of.',b=>{b.sphere('#c59a68',[0,.85,-.15],[.82,.77,1.34]).sphere('#dbb280',[0,1.65,.91],[.69,.65,.58]).sphere('#f0d7a6',[0,1.33,1.36],[.41,.25,.12]);for(let x of[-1,1]){b.cyl('#c89567',[x*.43,2.27,.93],0,.26,.65,[0,0,-x*.15],3).cyl('#dfa28c',[x*.43,2.27,1.08],0,.15,.36,[0,0,-x*.15],3).box('#3a5b4e',[x*.24,1.74,1.453],[.20,.042,.027],[0,0,x*.06]).sphere('#edd4ac',[x*.51,.21,.83],[.30,.20,.40]).sphere('#d1a678',[x*.53,.23,-.9],[.3,.23,.41]);for(let j=0;j<2;j++)b.box('#ab7b54',[x*.62,1.37+j*.19,.6],[.11,.071,.36],[0,x*.3,x*.23]);}b.sphere('#b37a69',[0,1.46,1.488],[.085,.055,.029]).box('#7c6e52',[0,1.355,1.49],[.022,.094,.02]);b.ring('#c69a67',[.73,1.01,-1.23],.58,.145,[0,PI/2,.35],16);for(let z of[-.72,-.34,.04])b.sphere('#a9805c',[0,1.58,z],[.49,.025,.09]);});
// A patchwork seed ball, with flat toy-like faces and small colored pads.
let b=new Builder();for(let i=0;i<G.sphere.length;i+=24){let a=G.sphere.slice(i,i+24),n=[a[0]+a[8]+a[16],a[1]+a[9]+a[17],a[2]+a[10]+a[18]],phase=Math.floor((Math.atan2(n[0],n[2])+PI)/TAU*7),cs=['#809bb0','#a5bb86','#88b9a6','#dfb5bd','#91ad9b','#c7d087','#97a3bd'];b.part(a,cs[(phase+(n[1]>1?2:0))%7],[0,0,0],[.96,.96,.96]);}
for(let i=0;i<12;i++){let y=1-(i+.5)/12*2,r=Math.sqrt(1-y*y),a=i*2.39996,d=[Math.cos(a)*r,y,Math.sin(a)*r],q=Q.fromTo([0,1,0],d),c=['#efbb70','#d496ab','#7cad98','#8a98b3'][i%4];b.part(cylinder(.20,.23,.075,8),c,V.scale(d,.96),[1,1,1],q).part(cylinder(.137,.153,.17,8),'#b8cd8f',V.scale(d,1.06),[1,1,1],q).part(cylinder(.137,.137,.025,8),'#f1dc99',V.scale(d,1.155),[1,1,1],q)}MESH.ball=b.build();
b=new Builder();b.cyl('#78ad96',[0,.43,0],.22,.30,.42,[],8).box('#a1c383',[0,.37,.19],[.3,.28,.08]).cyl('#e6b7a1',[0,.635,0],.20,.20,.07,[],10);MESH.avatarBody=b.build({outline:.012});
b=new Builder();b.sphere('#a7c683',[0,0,0],[.44,.29,.26]).sphere('#82b296',[-.31,0,0],[.13,.25,.23]).sphere('#82b296',[.31,0,0],[.13,.25,.23]).box('#f6dfb5',[0,-.009,.253],[.43,.29,.033]);b.sphere('#365b4b',[-.09,.022,.282],[.019,.030,.012]).sphere('#365b4b',[.09,.022,.282],[.019,.030,.012]).box('#d08c7b',[0,-.077,.284],[.068,.016,.015]).sphere('#e8aa99',[-.157,-.05,.277],[.036,.019,.012]).sphere('#e8aa99',[.157,-.05,.277],[.036,.019,.012]).cyl('#a8ac70',[0,.37,0],.022,.028,.28,[],6).star('#e6bd67',[0,.55,0],.26);MESH.avatarHead=b.build({outline:.008});
b=new Builder();b.cyl('#96bd8b',[0,-.105,0],.065,.06,.26,[],8).sphere('#efcbaf',[0,-.246,0],.075);MESH.avatarArm=b.build({outline:.01});b=new Builder();b.box('#947791',[0,-.12,0],[.105,.24,.11]).sphere('#d68596',[0,-.268,.045],[.094,.072,.145]);MESH.avatarLeg=b.build({outline:.01});
}

// The night market.
function initFestivalModels() {
 define('mochi','Moon mochi',18,.14,.35,.4,'snacks','A small moon. A soft landing.',b=>{b.sphere('#ffc9cb',[0,.20,0],[.35,.20,.31]);b.sphere('#fff3d1',[0,.34,.04],[.20,.065,.19]);b.box('#77b394',[0,.015,0],[.69,.022,.55]);});
 define('dango','Dango skewer',18,.21,.40,1.06,'snacks','Three little moons on a stick.',b=>{b.cyl('#c7a071',[0,.53,0],.025,.025,1.06,[],6);for(let i=0;i<3;i++)b.sphere(['#8fcb9b','#fff1c8','#f293b6'][i],[0,.25+i*.30,0],.205);});
 define('rice','Little rice triangle',20,.28,.5,.83,'snacks','A pocket-sized picnic.',b=>{b.cyl('#fff0ce',[0,.39,0],.47,.47,.36,[PI/2,0,PI/6],3).box('#244e4d',[0,.19,.198],[.28,.33,.025]);});
 define('fishcake','Lucky fish cake',22,.39,.64,.46,'snacks','A fish that swims in custard.',b=>{b.sphere('#e8a56b',[0,.22,0],[.44,.22,.31]).cyl('#e6a465',[-.48,.23,0],.28,.28,.10,[PI/2,0,PI/2],3).sphere('#533f43',[.28,.39,.11],[.033,.014,.033]);for(let i=0;i<3;i++)b.ring('#c58157',[-.15+i*.15,.405,0],.10,.012,[PI/2,0,0],8);});
 define('fan','Paper fan',24,.45,.70,.25,'bits','A small breeze, ready to go.',b=>{b.box('#b38867',[0,.09,.42],[.08,.10,.75]);for(let i=0;i<9;i++){let a=(i-4)*.19;b.box(i%2?'#f1c478':'#e98594',[Math.sin(a)*.30,.14,-Math.cos(a)*.16],[.16,.06,.74],[0,-a,0]);}b.box('#604d64',[0,.19,.26],[.10,.04,.13]);});
 define('fishbag','Goldfish guest',27,.62,.42,1.16,'toys','The fish has plans tonight.',b=>{b.sphere('#84ddcc',[0,.45,0],[.37,.43,.32]).sphere('#c0efdd',[0,.66,.08],[.27,.31,.19]).sphere('#f78c68',[0,.35,.255],[.20,.11,.07]).cyl('#ffb677',[-.20,.35,.26],.13,.13,.04,[PI/2,0,PI/2],3).sphere('#263c56',[.1,.37,.317],.018).cyl('#b0e9d7',[0,.88,0],.10,.19,.30,[],6).ring('#e998b4',[0,1.08,0],.09,.02);});
 define('mask','Fox festival mask',28,.72,.60,.46,'toys','A face for a moonlit parade.',b=>{b.sphere('#f9e9d3',[0,.19,0],[.45,.2,.54]);for(let x of[-1,1]){b.cyl('#ffe8d1',[x*.34,.19,-.37],0,.20,.37,[PI/2,0,0],3).sphere('#dc687d',[x*.22,.354,-.09],[.13,.018,.055],[0,x*.4,0]);}b.sphere('#343554',[0,.32,.40],[.058,.04,.075]);b.box('#e49b71',[0,.397,-.10],[.052,.019,.23]);});
 define('pinwheel','Windmill flower',29,.68,.67,1.55,'toys','A breeze in every direction.',b=>{b.cyl('#bb9470',[0,.62,0],.025,.035,1.24,[],6);for(let i=0;i<4;i++){let a=i*PI/2;b.cyl(['#f295b7','#87dcca','#ffcb6f','#b6a0e3'][i],[Math.sin(a)*.2,1.14+Math.cos(a)*.2,0],.30,.30,.04,[PI/2,0,a+.8],3);}b.sphere('#fff4c9',[0,1.14,.07],.085);});
 define('lantern','Peach paper lantern',34,1.2,.58,1.58,'festival','Take a little light with you.',b=>{b.sphere('#ffa171',[0,.76,0],[.53,.66,.50]);for(let y of[.23,.43,.68,.95,1.2])b.ring('#eb7857',[0,y,0],Math.sqrt(Math.max(.01,1-((y-.76)/.66)**2))*.532,.014,[PI/2,0,0],12);b.cyl('#513e54',[0,.10,0],.29,.29,.13,[],10).cyl('#513e54',[0,1.4,0],.27,.27,.13,[],10).ring('#ad7d6b',[0,1.53,0],.10,.019).box('#fff0b6',[0,.72,.498],[.14,.36,.014]);});P.lantern.mesh.emission=.8;
 define('bento','Midnight bento',36,1.55,.97,.48,'snacks','Dinner comes with a view.',b=>{b.box('#674254',[0,.17,0],[1.5,.32,1.0]).box('#eaa276',[0,.32,0],[1.37,.08,.87]);for(let x of[-.37,0,.37])b.sphere('#f7e9c9',[x,.39,.15],[.16,.08,.22]);b.sphere('#e07b80',[0,.45,.16],.075);b.box('#79b89a',[0,.42,-.2],[.47,.07,.25]).box('#efb371',[.43,.42,-.2],[.28,.07,.26]);});
 define('melon','Festival watermelon',39,1.65,.8,1.57,'snacks','One small, striped planet.',b=>{b.sphere('#68b393',[0,.79,0],.78);for(let i=0;i<8;i++){let a=i/8*TAU;b.ring('#36857e',[0,.79,0],.775,.018,[0,a,0],20);}b.cyl('#cec283',[0,1.6,0],.035,.035,.11,[],5);});
 define('basket','Peach picnic basket',48,3.1,1.03,1.5,'home','The whole picnic is invited.',b=>{b.box('#ba865d',[0,.44,0],[1.46,.79,1.20]);for(let y=.13;y<.86;y+=.16)b.box('#e1ad76',[0,y,0],[1.51,.06,1.25]);b.ring('#d9a373',[0,1.0,0],.50,.065);for(let x of[-.35,.2])for(let z of[-.29,.24])b.sphere('#eea290',[x,.92,z],.30);});
 define('luckycat','Lucky moon cat',55,4.9,1.0,2.48,'festival','One paw up. Good luck ahead.',b=>{b.cyl('#efb268',[0,.10,0],.94,.94,.20,[],12).sphere('#faecd4',[0,.87,0],[.68,.79,.51]).sphere('#fff0d9',[0,1.78,.08],[.65,.57,.48]);for(let x of[-1,1]){b.cyl('#f4e2cb',[x*.41,2.22,.08],0,.23,.51,[],3).box('#534650',[x*.22,1.85,.542],[.17,.039,.02],[0,0,-x*.15]).sphere('#e89d9b',[x*.38,1.70,.52],[.1,.047,.016]);}b.sphere('#c87983',[0,1.67,.58],[.06,.042,.025]).ring('#e08086',[0,1.35,0],.48,.045,[PI/2,0,0]).sphere('#f5c276',[0,1.25,.58],.14).sphere('#f7e9d2',[.69,1.46,.04],[.22,.53,.23]).sphere('#f8ead7',[.68,1.94,.11],[.23,.27,.24]).cyl('#efbd60',[-.24,.78,.48],.30,.30,.065,[PI/2,0,0],12).box('#ad744d',[-.24,.78,.525],[.045,.32,.019]);});
 define('drum','Moon festival drum',62,7.6,1.22,2.12,'festival','The parade has a heartbeat.',b=>{b.cyl('#dc7b7a',[0,1.05,0],1.02,.87,1.78,[],16).cyl('#f4d6a0',[0,1.97,0],1.06,1.06,.11,[],16).cyl('#f7e9c6',[0,2.035,0],.91,.91,.02,[],16).cyl('#57465b',[0,.15,0],1.02,1.02,.15,[],16);for(let i=0;i<12;i++){let a=i/12*TAU;b.sphere('#f6d696',[Math.cos(a)*1.037,1.90,Math.sin(a)*1.037],.045);}b.box('#c4a273',[0,2.10,0],[1.4,.055,.06],[0,.3,0]);});
 define('bunny','Festival rabbit',65,7.4,1.04,2.86,'toys','Long ears. A long night out.',b=>{b.sphere('#849eca',[0,.89,0],[.70,.83,.51]).sphere('#f8e4c6',[0,1.78,.05],[.65,.60,.48]);for(let x of[-1,1]){b.sphere('#f7e5c9',[x*.28,2.47,0],[.18,.51,.16],[0,0,-x*.11]).sphere('#e8adad',[x*.28,2.48,.148],[.083,.33,.021],[0,0,-x*.11]).sphere('#354259',[x*.23,1.88,.49],[.048,.064,.026]).sphere('#e4a5a1',[x*.40,1.74,.45],[.12,.07,.027]).sphere('#f4dfbe',[x*.35,.17,.17],[.28,.16,.36]);}b.sphere('#d68791',[0,1.68,.525],[.059,.04,.027]).box('#f2c77f',[0,.92,.517],[1.19,.28,.043]).sphere('#ebbb7b',[-.63,.87,.28],.19).sphere('#efd8b4',[.66,1.04,.1],.20);});
 define('stool','Festival stool',68,8.4,1.33,2.0,'home','A seat with a new view.',b=>{b.cyl('#e39383',[0,1.8,0],1.2,1.08,.36,[],14).cyl('#f8c192',[0,1.99,0],1.04,1.04,.025,[],14);for(let x of[-.70,.70])for(let z of[-.70,.70])b.box('#a78875',[x,.81,z],[.20,1.62,.20],[z*.1,0,x*-.1]);});
 define('shrub','Moon garden shrub',74,10.2,1.6,2.95,'home','A whole small garden.',b=>{b.cyl('#dc9982',[0,.58,0],1.12,.79,1.12,[],10).cyl('#edb48b',[0,1.06,0],1.20,1.18,.18,[],10).cyl('#805567',[0,1.18,0],1.07,1.07,.03,[],10).cyl('#8e7e68',[0,1.72,0],.11,.17,1.38,[],7);for(let i=0;i<6;i++){let a=i*2.4;b.sphere(i%2?'#66adad':'#86c2b1',[Math.sin(a)*.7,2.1+i%3*.22,Math.cos(a)*.6],[.73,.61,.72]);}b.sphere('#a9d7b6',[0,2.75,0],[.70,.35,.61]);});
 define('parasol','Paper parasol',79,12.5,2.06,3.55,'festival','A roof for the little things.',b=>{b.cyl('#8f7164',[0,1.6,0],.065,.095,3.2,[],8).cyl('#e787a5',[0,3.18,0],.08,1.98,.66,[],16).cyl('#f5be93',[0,2.83,0],1.99,1.99,.06,[],16);for(let i=0;i<16;i++){let a=i/16*TAU;beam(b,'#f5bba4',[0,3.52,0],[Math.sin(a)*1.98,2.89,Math.cos(a)*1.98],.012)}b.cyl('#6e6370',[0,.16,0],.43,.55,.28,[],10);});
 define('frog','The pond mayor',83,14.7,1.9,2.80,'toys','A very important frog.',b=>{b.sphere('#86c3ac',[0,.85,0],[1.25,.83,1.10]).sphere('#9bd3b5',[0,1.73,.16],[1.23,.74,.85]).sphere('#d9dfaa',[0,.95,.95],[.77,.58,.17]);for(let x of[-1,1]){b.sphere('#99d3b0',[x*.75,2.22,.31],.44).sphere('#f3e8b8',[x*.75,2.28,.65],[.30,.30,.16]).sphere('#34495b',[x*.75,2.29,.805],[.13,.18,.034]).sphere('#85b8a4',[x*1.1,.29,.50],[.57,.24,.74]);}b.box('#518b85',[0,1.58,1.005],[.95,.045,.03]).cyl('#e9b66e',[0,2.69,0],.20,.61,.24,[],8);});
 define('cooler','Midnight soda cooler',90,18,1.93,2.72,'snacks','Enough fizz for a galaxy.',b=>{b.box('#74bcb6',[0,1.28,0],[2.75,2.35,1.83]).box('#f3e5bf',[0,2.53,0],[2.84,.33,1.92]).box('#d3e5ce',[0,1.1,.937],[1.90,.67,.04]).box('#526c82',[-1.47,1.54,0],[.13,.64,.7]).box('#526c82',[1.47,1.54,0],[.13,.64,.7]).box('#e8b480',[0,1.10,.97],[1.4,.11,.025]);});
 define('lampstand','Garden lantern',93,19.2,1.5,4.56,'festival','The night comes along for the ride.',b=>{b.cyl('#5c667e',[0,.25,0],.76,1.07,.50,[],8).cyl('#58617a',[0,1.92,0],.13,.24,3.5,[],8).box('#f5c174',[0,3.53,0],[1.26,1.45,1.24]);for(let x of[-.68,.68])for(let z of[-.67,.67])b.box('#5b5670',[x,3.56,z],[.10,1.58,.10]);b.cyl('#64536e',[0,4.42,0],0,1.10,.53,[],4).box('#73657a',[0,2.79,0],[1.58,.16,1.54]);});P.lampstand.mesh.emission=.26;
 define('bench','Canal bench',102,25.2,2.85,2.63,'home','Please remain seated. Or roll.',b=>{for(let z of[-.45,0,.45])b.box('#c39786',[0,1.24,z],[4.9,.22,.36]);for(let y of[1.71,2.25])b.box('#dab098',[0,y,-.73],[4.9,.34,.16]);for(let x of[-1.90,1.90]){b.box('#57627c',[x,.63,0],[.22,1.26,1.5]).box('#57627c',[x,1.66,-.71],[.20,1.89,.20]).box('#737c93',[x,1.61,0],[.20,.15,1.40]);}});
 define('cart','Moon soda cart',116,35,3.1,4.85,'festival','The night market is on the move.',b=>{b.box('#7dbdb0',[0,1.35,0],[3.75,1.80,2.20]).box('#f1cf9c',[0,2.35,0],[4.12,.23,2.50]);for(let x of[-1.7,1.7])for(let z of[-1,1])b.box('#aa8275',[x,3.22,z],[.12,2.0,.12]);for(let i=0;i<8;i++)b.box(i%2?'#f4ca97':'#e59da8',[-1.85+i*.53,4.18,0],[.53,.14,3.2],[-.12,0,0]);for(let x of[-1.5,1.5])for(let z of[-1.2,1.2]){b.cyl('#42516b',[x,.48,z],.45,.45,.18,[PI/2,0,0],12).cyl('#d4c4aa',[x,.48,z*1.09],.21,.21,.06,[PI/2,0,0],12);}for(let x of[-.8,0,.8])b.cyl('#eeb06e',[x,2.70,.2],.21,.24,.54,[],10);b.box('#fbdb9b',[0,1.5,1.115],[2.2,.78,.06]);b.star('#d9798d',[0,1.5,1.16],.54);});
 define('dragon','The paper moon dragon',135,54,3.6,4.7,'festival','The guest of honor. All yours.',b=>{b.sphere('#8fcfc0',[0,1.70,-.5],[1.66,1.43,2.43]).sphere('#a7dcc2',[0,2.70,1.43],[1.33,1.05,1.16]).sphere('#e2dba8',[0,2.19,2.31],[1.22,.50,.57]);for(let x of[-1,1]){b.sphere('#f8e8ad',[x*.88,3.28,2.10],[.45,.48,.29]).sphere('#434361',[x*.89,3.31,2.34],[.19,.27,.06]).cyl('#e5bc80',[x*.90,3.95,1.4],0,.27,1.3,[0,0,-x*.28],6).sphere('#d78ca6',[x*1.14,2.50,2.09],[.19,.26,.11]).sphere('#80b3af',[x*1.12,.45,1.25],[.65,.44,.72]).sphere('#80b3af',[x*1.14,.43,-1.91],[.65,.43,.73]);beam(b,'#e8c387',[x*.80,2.35,2.73],[x*1.68,2.87,2.75],.045);}for(let z=-2.5;z<.9;z+=.68)b.cyl('#e1af8b',[0,3.04-Math.abs(z+1)*.26,z],0,.41,.83,[],4);b.cyl('#7ba9ac',[0,1.47,-3.1],0,.63,1.7,[PI/2,0,0],6);});
 let b=new Builder();b.sphere('#ffd18e',[0,0,0],[.57,.79,.55]);for(let y of[-.65,-.4,0,.4,.65])b.ring('#f6966a',[0,y,0],Math.sqrt(Math.max(.06,1-(y/.82)**2))*.57,.015,[PI/2,0,0],12);b.cyl('#4d4865',[0,.74,0],.27,.27,.11,[],10).cyl('#56405b',[0,-.77,0],.26,.26,.12,[],10);MESH.stringLantern=b.build({emission:2.4});
 b=new Builder();b.box('#facb8d',[0,0,0],[.85,1.2,.80]).box('#ef927e',[0,-.50,0],[.9,.1,.85]).cyl('#ffd8a6',[0,-.72,0],.13,.03,.24,[],7);MESH.skyLantern=b.build({emission:1.6,noShadow:true});
 b=new Builder();b.sphere('#a4ffd0',[0,0,0],.07);MESH.firefly=b.build({emission:5,unlit:true,noShadow:true});
 b=new Builder();b.quad([-.09,0,0],[0,-.035,-.07],[.09,0,0],[0,.04,.1],'#ffbfcc');MESH.petal=b.build({doubleSided:true,roughness:.8});
 for(let c of['#ffd49b','#ff9cb8','#86f9dc','#b4b3ff']){let q=new Builder();q.sphere(c,[0,0,0],1);MESH.sparks.push(q.build({emission:4,unlit:true,noShadow:true}));}
 b=new Builder();for(let i=0;i<4;i++){let a=i*PI/2;b.cyl(['#f594b5','#9adbd1','#ffd296','#acaaeb'][i],[Math.sin(a)*.76,Math.cos(a)*.76,0],.83,.83,.08,[PI/2,0,a+.8],3);}b.sphere('#f4dfb4',[0,0,.13],.17);MESH.windmill=b.build();
 // Keep the seed ball bright against the blue night.
 MESH.ball.roughness=.29;MESH.ball.metalness=.12;MESH.ball.emission=.12;
}

// New for the Lantern Tide: a few more little things, and the floating lanterns of the canal.
function initTideModels() {
 define('crane', 'Paper crane', 15, .05, .32, .32, 'bits', 'Folded for a thousand little wishes.', b => {
  b.box('#f4a3b8', [0, .1, 0], [.16, .14, .30])
   .box('#f7c0cd', [-.17, .18, 0], [.32, .02, .22], [0, 0, -.35])
   .box('#f7c0cd', [.17, .18, 0], [.32, .02, .22], [0, 0, .35])
   .cyl('#f4a3b8', [0, .18, .19], 0, .045, .26, [.9, 0, 0], 4)
   .cyl('#f4a3b8', [0, .16, -.19], 0, .045, .24, [-.9, 0, 0], 4)
   .box('#e98aa3', [0, .27, .29], [.035, .035, .09], [.5, 0, 0]);
 });
 define('yoyo', 'Water balloon yo-yo', 19, .19, .36, .78, 'toys', 'It always bounces back.', b => {
  b.sphere('#8fd3e8', [0, .31, 0], .3)
   .ring('#f6f1d8', [0, .31, 0], .3, .02, [0, 0, 0], 14)
   .ring('#f59bb3', [0, .31, 0], .3, .02, [0, PI / 2, 0], 14)
   .sphere('#d8f2f7', [-.1, .42, .2], [.07, .05, .03])
   .cyl('#f3e1b8', [0, .66, 0], .008, .008, .12, [], 4)
   .ring('#f3e1b8', [0, .74, 0], .05, .01, [], 8);
 });
 define('kendama', 'Wooden kendama', 21, .3, .42, .96, 'toys', 'Catch, cup, and one more try.', b => {
  b.cyl('#d9a86c', [0, .3, 0], .05, .06, .6, [], 8)
   .cyl('#c98f58', [0, .58, 0], .09, .09, .36, [0, 0, PI / 2], 10)
   .cyl('#e8c28a', [-.2, .58, 0], .11, .08, .06, [0, 0, PI / 2], 10)
   .cyl('#e8c28a', [.2, .58, 0], .08, .11, .06, [0, 0, PI / 2], 10)
   .sphere('#e36f6f', [0, .82, 0], .14)
   .ring('#fff0cf', [0, .82, 0], .141, .014, [PI / 2, 0, 0], 12)
   .cyl('#efe2c6', [.1, .7, 0], .006, .006, .22, [0, 0, .5], 4);
 });
 define('lanternboat', 'Floating lantern', 24, .5, .42, .6, 'festival', 'It was drifting somewhere nice.', b => {
  b.box('#8d6a5a', [0, .05, 0], [.62, .1, .62])
   .box('#f0a07a', [0, .12, 0], [.5, .04, .5])
   .box('#ffd9a0', [0, .34, 0], [.44, .42, .44])
   .box('#e9926f', [0, .57, 0], [.52, .05, .52])
   .box('#fff3cf', [0, .34, .222], [.13, .24, .012])
   .box('#fff3cf', [0, .34, -.222], [.13, .24, .012]);
 }, { emission: .9 });
 define('shavedice', 'Shaved ice cup', 26, .45, .40, .86, 'snacks', 'A tiny snowy mountain. Strawberry, of course.', b => {
  b.cyl('#f2e7cf', [0, .18, 0], .34, .26, .36, [], 12)
   .ring('#8fcfc0', [0, .24, 0], .315, .022, [PI / 2, 0, 0], 12)
   .ring('#f59bb3', [0, .31, 0], .33, .016, [PI / 2, 0, 0], 12)
   .sphere('#fbf6f0', [0, .43, 0], [.36, .28, .36])
   .sphere('#f28da0', [0, .58, 0], [.27, .16, .27])
   .cyl('#f7d774', [.12, .7, .05], .02, .02, .32, [0, 0, -.4], 5);
 });
 define('koi', 'Koi streamer', 88, 16, 1.3, 4.5, 'festival', 'It swims up the wind all night long.', b => {
  b.cyl('#6e6370', [0, .12, 0], .42, .52, .24, [], 10)
   .cyl('#8f7a6a', [0, 2.3, 0], .06, .09, 4.3, [], 8)
   .sphere('#f2c45a', [0, 4.46, 0], .13)
   .box('#d9b56f', [.2, 4.22, 0], [.4, .04, .04])
   .sphere('#e9736b', [1.05, 3.75, 0], [.95, .36, .32])
   .ring('#fff1d6', [.14, 3.75, 0], .31, .05, [0, PI / 2, 0], 12)
   .sphere('#fff6e6', [.4, 3.86, .27], [.1, .1, .04]).sphere('#2f3550', [.41, 3.86, .305], [.05, .05, .02])
   .sphere('#fff6e6', [.4, 3.86, -.27], [.1, .1, .04]).sphere('#2f3550', [.41, 3.86, -.305], [.05, .05, .02])
   .sphere('#e25f5f', [2.08, 3.95, 0], [.3, .2, .05], [0, 0, .55]).sphere('#e25f5f', [2.08, 3.55, 0], [.3, .2, .05], [0, 0, -.55]);
  for (let i = 0; i < 4; i++) {
   const x = .7 + i * .34, k = Math.sqrt(Math.max(0, 1 - ((x - 1.05) / .95) ** 2));
   b.sphere('#f7a883', [x, 3.75 + .36 * k, 0], [.13, .06, .2 * k + .02]);
  }
  b.sphere('#6fa3d8', [.85, 2.95, 0], [.75, .28, .25])
   .ring('#fff1d6', [.12, 2.95, 0], .24, .04, [0, PI / 2, 0], 12)
   .sphere('#fff6e6', [.34, 3.03, .2], [.08, .08, .03]).sphere('#2f3550', [.35, 3.03, .225], [.04, .04, .02])
   .sphere('#fff6e6', [.34, 3.03, -.2], [.08, .08, .03]).sphere('#2f3550', [.35, 3.03, -.225], [.04, .04, .02])
   .sphere('#4f86c0', [1.66, 3.1, 0], [.24, .16, .04], [0, 0, .55]).sphere('#4f86c0', [1.66, 2.8, 0], [.24, .16, .04], [0, 0, -.55]);
 });
}

// Small original item portraits, drawn from the same 3D geometry as the game.
export function thumbFor(p){if(p.thumb)return p.thumb;let c=document.createElement('canvas');c.width=c.height=112;let ctx=c.getContext('2d'),a=p.mesh.raw,q=Q.euler(.32,-.62,0),tris=[],minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let i=0;i<a.length;i+=36){let n=Q.rot(q,a.slice(i+3,i+6));if(n[2]<-.1)continue;let ps=[];for(let j=0;j<3;j++){let v=Q.rot(q,a.slice(i+j*12,i+j*12+3));ps.push(v);minX=Math.min(minX,v[0]);maxX=Math.max(maxX,v[0]);minY=Math.min(minY,v[1]);maxY=Math.max(maxY,v[1]);}let sun=Math.max(V.dot(a.slice(i+3,i+6),V.norm([-.55,.85,.55])),0),fac=.78+sun*.28;tris.push({p:ps,z:ps.reduce((s,v)=>s+v[2],0)/3,c:a.slice(i+6,i+9).map(v=>Math.round(clamp(v*fac,0,1)*255))});}let s=88/Math.max(maxX-minX,maxY-minY),mx=(minX+maxX)/2,my=(minY+maxY)/2;ctx.fillStyle='rgba(40,60,40,.10)';ctx.beginPath();ctx.ellipse(56,94,28,7,0,0,TAU);ctx.fill();tris.sort((a,b)=>a.z-b.z).forEach(t=>{ctx.fillStyle=`rgb(${t.c.join(',')})`;ctx.beginPath();t.p.forEach((v,i)=>ctx[i?'lineTo':'moveTo'](56+(v[0]-mx)*s,54-(v[1]-my)*s));ctx.closePath();ctx.fill()});p.thumb=c.toDataURL();return p.thumb}
