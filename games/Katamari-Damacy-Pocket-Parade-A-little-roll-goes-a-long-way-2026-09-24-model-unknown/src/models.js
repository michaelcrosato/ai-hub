// Pocket Parade. Every little thing in the room, built from coloured parts. Each model is
// centred on its own height so items rest on the floor at y = base + height / 2.
import { Builder, G, Q, V, PI, TAU, clamp, cylinder } from './geometry.js';

export const P = {};
export const MODELS = {};
export const colors = { ink: '#284941', cream: '#fff2c9', pink: '#f092a4', red: '#ea7361', mint: '#75b69a', lime: '#cbd873', teal: '#568e87', yellow: '#efc963', blue: '#80aab2', brown: '#ae7954', dark: '#805b44' };

/** id, display name, size needed (cm), volume gained, footprint radius, height, group, pickup note. */
function define(id, name, need, volume, radius, height, group, note, build) {
  const b = new Builder();
  build(b);
  b.shift(0, -height / 2, 0);
  P[id] = { id, name, need, volume, radius, height, group, note, mesh: b.build() };
  return P[id];
}

export function initModels() {
const C = colors;
// ---- The sunny-side room: every original little thing.
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
// ---- The Big Tidy (encore): furniture-sized things, built from the same toy parts.
define('lamp', 'Paper lamp', 42, 2.2, .75, 2.56, 'home', 'A little light for a big star.', (b) => {
  b.cyl('#c9a77c', [0, .06, 0], .42, .46, .12, [], 12).cyl('#8a6d50', [0, .95, 0], .05, .05, 1.7, [], 6)
    .cyl('#f6e7c4', [0, 2.08, 0], .46, .66, .9, [], 12)
    .ring('#d9b98a', [0, 2.53, 0], .46, .03, [PI / 2, 0, 0], 12).ring('#d9b98a', [0, 1.63, 0], .66, .03, [PI / 2, 0, 0], 12)
    .sphere('#fff3c9', [0, 1.72, 0], .16);
});
define('globe', 'Desk globe', 44, 2.4, .8, 2.0, 'home', 'The whole world, rolled up.', (b) => {
  b.cyl('#b0855f', [0, .08, 0], .42, .5, .16, [], 12).cyl('#8a6d50', [0, .36, 0], .06, .08, .42, [], 6)
    .sphere('#86b5b0', [0, 1.22, 0], .68)
    .sphere('#a5c487', [.26, 1.44, .44], [.26, .2, .12], [0, .52, 0])
    .sphere('#a5c487', [-.39, 1.0, .4], [.22, .28, .12], [0, -.77, 0])
    .sphere('#a5c487', [.12, .95, -.56], [.32, .2, .12], [0, 2.94, 0])
    .sphere('#eef0e2', [0, 1.88, 0], [.2, .05, .2])
    .ring('#d9b06a', [0, 1.22, 0], .76, .035, [.41, .3, 0], 20);
});
define('uke', 'Toy ukulele', 46, 2.0, 1.25, .46, 'toys', 'Strum a little song for the sky.', (b) => {
  b.sphere('#e3a86a', [-.45, .22, 0], [.56, .2, .5]).sphere('#e3a86a', [.08, .22, 0], [.42, .19, .38])
    .cyl('#5e4636', [-.3, .415, 0], .15, .15, .02, [], 12)
    .box('#b07a4e', [.88, .24, 0], [1.0, .09, .17]).box('#8a5d3c', [1.48, .26, 0], [.3, .1, .25])
    .box('#7a5137', [-.74, .42, 0], [.08, .05, .34]);
  for (const z of [-.06, -.02, .02, .06]) b.box('#f4ead0', [.36, .405, z], [2.2, .01, .01], [0, 0, -.06]);
  for (const z of [-.09, .09]) b.cyl('#f4ead0', [1.48, .34, z], .025, .025, .07, [], 6);
});
define('stool', 'Little stool', 50, 2.9, .95, 1.82, 'home', 'Take a seat. Take the stool.', (b) => {
  b.cyl('#d39a72', [0, 1.73, 0], .84, .84, .16, [], 16).cyl('#efc79a', [0, 1.815, 0], .7, .7, .012, [], 16);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; b.cyl('#a87652', [Math.cos(a) * .56, .83, Math.sin(a) * .56], .075, .095, 1.66, [], 8); }
  b.ring('#a87652', [0, .55, 0], .57, .04, [PI / 2, 0, 0], 16);
});
define('basket', 'Laundry basket', 54, 3.8, 1.15, 1.68, 'home', 'Fresh laundry, freshly rolled.', (b) => {
  b.cyl('#c9b28a', [0, .72, 0], 1.05, .86, 1.44, [], 18);
  for (let i = 1; i < 5; i++) { const y = i * .29, r = .86 + .19 * y / 1.44 + .012; b.ring('#a88f68', [0, y, 0], r, .028, [PI / 2, 0, 0], 18); }
  b.ring('#efe0bd', [0, 1.44, 0], 1.05, .07, [PI / 2, 0, 0], 18)
    .sphere('#e9a7b1', [-.3, 1.47, .22], [.52, .2, .42], [0, .4, 0]).sphere('#9fc1d0', [.36, 1.5, -.16], [.46, .18, .38], [0, -.3, 0])
    .sphere('#f4e9c9', [.1, 1.56, .36], [.3, .12, .24], [0, 1.1, 0]);
  for (const x of [-1, 1]) b.box('#a88f68', [x * 1.03, 1.2, 0], [.07, .26, .46], [0, 0, x * .12]);
});
define('horse', 'Rocking horse', 60, 4.6, 1.45, 2.36, 'toys', 'Giddy-up, little star.', (b) => {
  for (const z of [-.38, .38]) b.box('#b9805c', [0, .07, z], [1.4, .1, .12]).box('#b9805c', [-1.05, .2, z], [.85, .1, .12], [0, 0, -.32]).box('#b9805c', [1.05, .2, z], [.85, .1, .12], [0, 0, .32]);
  for (const x of [-.55, .55]) for (const z of [-.3, .3]) b.box('#efe2c4', [x, .62, z], [.13, .95, .13]);
  b.sphere('#f1e6cc', [0, 1.25, 0], [.86, .38, .36])
    .box('#d9817a', [-.05, 1.6, 0], [.52, .08, .64])
    .box('#f1e6cc', [.72, 1.66, 0], [.3, .78, .3], [0, 0, -.45])
    .box('#f1e6cc', [1.06, 2.0, 0], [.62, .3, .3], [0, 0, -.2])
    .box('#d7a35f', [.6, 1.92, 0], [.14, .62, .36], [0, 0, -.45])
    .cyl('#d7a35f', [-.94, 1.24, 0], .04, .15, .52, [0, 0, 1.0], 6)
    .cyl('#9a6a48', [.92, 2.02, 0], .03, .03, .74, [PI / 2, 0, 0], 6);
  for (const z of [-1, 1]) {
    b.cyl('#f1e6cc', [.95, 2.25, z * .1], 0, .06, .16, [], 5)
      .sphere(C.ink, [1.1, 2.07, z * .155], [.035, .045, .02])
      .sphere('#b9805c', [1.37, 1.93, z * .07], [.02, .03, .03]);
  }
});
define('house', 'Doll house', 66, 6.0, 1.5, 3.0, 'toys', 'A whole little home, rolled up.', (b) => {
  const ang = Math.atan2(.95, .85), len = Math.hypot(.95, .85) + .08;
  b.box('#c7a77e', [0, .04, 0], [2.4, .08, 1.7]).box('#efd9b0', [0, 1.0, 0], [2.2, 1.84, 1.5])
    .box('#d9817a', [0, 2.395, .425], [2.42, .1, len], [ang, 0, 0]).box('#d9817a', [0, 2.395, -.425], [2.42, .1, len], [-ang, 0, 0])
    .tri([1.1, 1.92, .75], [1.1, 1.92, -.75], [1.1, 2.8, 0], '#efd9b0')
    .tri([-1.1, 1.92, -.75], [-1.1, 1.92, .75], [-1.1, 2.8, 0], '#efd9b0')
    .box('#86b5b0', [-.55, 1.32, .755], [.46, .42, .02]).box('#86b5b0', [.55, 1.32, .755], [.46, .42, .02])
    .box('#b9805c', [0, .5, .755], [.44, .8, .02]).sphere('#e5bc62', [.13, .5, .775], .035)
    .box('#86b5b0', [1.105, 1.3, 0], [.02, .42, .5]).box('#86b5b0', [-1.105, 1.3, 0], [.02, .42, .5])
    .box('#b06e66', [.62, 2.72, -.25], [.24, .55, .24]);
  for (const x of [-.55, .55]) b.box('#f4e9c9', [x, 1.32, .77], [.04, .42, .02]).box('#f4e9c9', [x, 1.32, .77], [.46, .04, .02]);
});
define('beanbag', 'Bean bag', 72, 7.5, 1.75, 1.7, 'home', 'The comfiest thing in the room.', (b) => {
  b.sphere('#e7a493', [0, .6, 0], [1.66, .6, 1.56]).sphere('#eeb3a3', [0, 1.04, -.5], [1.26, .62, .88], [-.35, 0, 0])
    .sphere('#f2c2b2', [0, 1.0, .38], [.92, .15, .8]).box('#f4e9c9', [1.3, .5, .98], [.22, .12, .02], [0, .7, 0]);
});
// ---- The ball: a patchwork seed with flat toy-like faces and small coloured pads. Then the little roller.
let b=new Builder();for(let i=0;i<G.sphere.length;i+=24){let a=G.sphere.slice(i,i+24),n=[a[0]+a[8]+a[16],a[1]+a[9]+a[17],a[2]+a[10]+a[18]],phase=Math.floor((Math.atan2(n[0],n[2])+PI)/TAU*7),cs=['#809bb0','#a5bb86','#88b9a6','#dfb5bd','#91ad9b','#c7d087','#97a3bd'];b.part(a,cs[(phase+(n[1]>1?2:0))%7],[0,0,0],[.96,.96,.96]);}
for(let i=0;i<12;i++){let y=1-(i+.5)/12*2,r=Math.sqrt(1-y*y),a=i*2.39996,d=[Math.cos(a)*r,y,Math.sin(a)*r],q=Q.fromTo([0,1,0],d),c=['#efbb70','#d496ab','#7cad98','#8a98b3'][i%4];b.part(cylinder(.20,.23,.075,8),c,V.scale(d,.96),[1,1,1],q).part(cylinder(.137,.153,.17,8),'#b8cd8f',V.scale(d,1.06),[1,1,1],q).part(cylinder(.137,.137,.025,8),'#f1dc99',V.scale(d,1.155),[1,1,1],q)}MODELS.ball=b.build();
b=new Builder();b.cyl('#78ad96',[0,.43,0],.22,.30,.42,[],8).box('#a1c383',[0,.37,.19],[.3,.28,.08]).cyl('#e6b7a1',[0,.635,0],.20,.20,.07,[],10);MODELS.body=b.build({outline:.012});
b=new Builder();b.sphere('#a7c683',[0,0,0],[.44,.29,.26]).sphere('#82b296',[-.31,0,0],[.13,.25,.23]).sphere('#82b296',[.31,0,0],[.13,.25,.23]).box('#f6dfb5',[0,-.009,.253],[.43,.29,.033]);b.sphere('#365b4b',[-.09,.022,.282],[.019,.030,.012]).sphere('#365b4b',[.09,.022,.282],[.019,.030,.012]).box('#d08c7b',[0,-.077,.284],[.068,.016,.015]).sphere('#e8aa99',[-.157,-.05,.277],[.036,.019,.012]).sphere('#e8aa99',[.157,-.05,.277],[.036,.019,.012]).cyl('#a8ac70',[0,.37,0],.022,.028,.28,[],6).star('#e6bd67',[0,.55,0],.26);MODELS.head=b.build({outline:.008});
b=new Builder();b.cyl('#96bd8b',[0,-.105,0],.065,.06,.26,[],8).sphere('#efcbaf',[0,-.246,0],.075);MODELS.arm=b.build({outline:.01});b=new Builder();b.box('#947791',[0,-.12,0],[.105,.24,.11]).sphere('#d68596',[0,-.268,.045],[.094,.072,.145]);MODELS.leg=b.build({outline:.01});
}

// Small original item portraits, drawn from the same 3D geometry as the game.
const SUN = V.norm([-.55, .85, .55]);
export function thumbFor(p) {
  if (p.thumb) return p.thumb;
  const c = document.createElement('canvas');
  c.width = c.height = 112;
  const ctx = c.getContext('2d'), a = p.mesh.raw, q = Q.euler(.32, -.62, 0), tris = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < a.length; i += 36) {
    const n = Q.rot(q, [a[i + 3], a[i + 4], a[i + 5]]);
    if (n[2] < -.1) continue;
    const ps = [];
    for (let j = 0; j < 3; j++) {
      const o = i + j * 12, v = Q.rot(q, [a[o], a[o + 1], a[o + 2]]);
      ps.push(v);
      minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]); minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    }
    const sun = Math.max(V.dot([a[i + 3], a[i + 4], a[i + 5]], SUN), 0), fac = .78 + sun * .28;
    tris.push({ p: ps, z: (ps[0][2] + ps[1][2] + ps[2][2]) / 3, c: [a[i + 6], a[i + 7], a[i + 8]].map((v) => Math.round(clamp(v * fac, 0, 1) * 255)) });
  }
  const s = 88 / Math.max(maxX - minX, maxY - minY), mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  ctx.fillStyle = 'rgba(40,60,40,.10)';
  ctx.beginPath();
  ctx.ellipse(56, 94, 28, 7, 0, 0, TAU);
  ctx.fill();
  tris.sort((x, y) => x.z - y.z);
  for (const t of tris) {
    ctx.fillStyle = `rgb(${t.c[0]},${t.c[1]},${t.c[2]})`;
    ctx.beginPath();
    t.p.forEach((v, i) => ctx[i ? 'lineTo' : 'moveTo'](56 + (v[0] - mx) * s, 54 - (v[1] - my) * s));
    ctx.closePath();
    ctx.fill();
  }
  p.thumb = c.toDataURL();
  return p.thumb;
}
