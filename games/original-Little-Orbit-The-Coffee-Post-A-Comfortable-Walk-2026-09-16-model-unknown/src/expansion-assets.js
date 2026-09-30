/* Original, low-poly destination kit. Exported with the courier to editable GLB.
 * Y is up. Each mesh part has a stable name. No baked scenery images. */
const G=(name,children,p=[0,0,0],r=[0,0,0])=>({name,children,p,r});
const P=(name,shape,color,p,s,r=[0,0,0])=>({name,shape,color,p,s,r});
const B=(n,c,p,s,r)=>P(n,'box',c,p,s,r);
const S=(n,c,p,s)=>P(n,'smooth',c,p,s);
const C=(n,c,p,s,r)=>P(n,'cylinder',c,p,s,r);
const wood='#aa7955',cream='#fff1d1',dark='#765547',green='#547e72',gold='#efc775';
const expansionAssets={};
expansionAssets.bath_pool=G('bath_pool',[
 C('stone_base','#b6b8a5',[0,.17,0],[2.4,.34,1.95]),
 P('rounded_rim','torus','#e9ddbd',[0,.43,0],[2.40,.65,1.95]),
 C('warm_water','#93c7ba',[0,.49,0],[1.66,.045,1.34]),
 ...Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return S('edge_stone_'+i,i%3?'#d0c9b0':'#ded5b8',[Math.cos(a)*2.14,.40,Math.sin(a)*1.72],[.38,.25,.29]);})
]);
expansionAssets.bath_tap=G('bath_tap',[
 B('pedestal','#dfc9a2',[0,.45,0],[.64,.90,.64]),C('pipe',green,[0,1.06,0],[.075,.5,.075]),C('spout',green,[0,1.27,.16],[.075,.38,.075],[Math.PI/2,0,0]),
 G('tap_wheel',[P('wheel','torus',gold,[0,0,0],[.23,.10,.23],[Math.PI/2,0,0]),B('handle',gold,[0,0,0],[.48,.06,.06])],[0,1.55,0])
]);
expansionAssets.kiln=G('kiln',[
 C('brick_base','#bd7760',[0,.55,0],[1.38,1.10,1.25]),S('dome','#ce8c69',[0,1.09,0],[1.4,1.45,1.26]),
 B('fire_mouth',dark,[0,.63,1.15],[1.17,1.18,.13]),S('arch_dark',dark,[0,1.18,1.18],[.585,.51,.07]),
 B('warm_embers','#e5a05d',[0,.29,1.24],[.87,.14,.05]),B('hearth','#ad9b83',[0,.09,1.40],[1.90,.18,.85]),
 C('chimney','#b37459',[0,2.60,-.28],[.32,1.34,.32]),C('chimney_cap','#ead5ae',[0,3.26,-.28],[.44,.16,.44]),
 ...Array.from({length:9},(_,i)=>{const a=(i+.5)/9*Math.PI;return B('arch_brick_'+i,'#edbf88',[Math.cos(a)*.76,.91+Math.sin(a)*.82,1.26],[.31,.25,.22],[0,0,a-Math.PI/2]);})
]);
expansionAssets.pottery_table=G('pottery_table',[
 B('tabletop',wood,[0,.92,0],[2.6,.16,1.12]),...[-1,1].flatMap(x=>[-1,1].map(z=>B('leg_'+x+z,dark,[x*1.04,.44,z*.40],[.12,.88,.12]))),
 C('wheel',cream,[0,1.04,0],[.43,.10,.43]),C('clay_lump','#c39076',[0,1.21,0],[.19,.30,.19]),B('clay_cutting_tool',green,[.80,1.06,.1],[.37,.04,.12]),
 C('glaze_pot',green,[-.82,1.18,0],[.21,.40,.21])
]);
expansionAssets.archive_shelf=G('archive_shelf',[
 ...[-1,1].map(x=>B('upright_'+x,wood,[x*.70,1.12,0],[.13,2.24,.48])),
 ...[.12,.81,1.50,2.20].map((y,i)=>B('shelf_'+i,wood,[0,y,0],[1.54,.12,.54])),
 ...Array.from({length:15},(_,i)=>B('volume_'+i,['#96a88b','#d5a080','#d6bf83','#819d9e'][i%4],[(i%5-2)*.245,.43+Math.floor(i/5)*.69,0],[.18,.49-(i%3)*.055,.37],[0,0,(i%3-1)*.055]))
]);
expansionAssets.open_book=G('open_book',[
 B('book_stand',dark,[0,.63,0],[.16,1.26,.16]),B('stand_foot',wood,[0,.06,0],[1.1,.12,.65]),
 B('cover',green,[0,1.32,0],[1.42,.11,.91],[.24,0,0]),
 G('turn_page',[B('left_page',cream,[-.34,0,0],[.62,.05,.82],[0,0,-.08]),B('right_page',cream,[.34,0,0],[.62,.05,.82],[0,0,.08]),
 ...Array.from({length:4},(_,i)=>B('ink_'+i,'#a6a48b',[-.34,.035,-.24+i*.14],[.44,.012,.018]))],[0,1.4,0],[.24,0,0])
]);
expansionAssets.cinema_projector=G('cinema_projector',[
 B('body','#708b86',[0,1.15,0],[.73,.63,.63]),B('stand',dark,[0,.53,0],[.14,1.0,.14]),B('foot',dark,[0,.08,0],[.78,.16,.66]),
 C('lens',gold,[0,1.15,.40],[.16,.31,.16],[Math.PI/2,0,0]),
 ...[-.28,.28].map((x,i)=>G('reel_'+i,[C('film',dark,[0,0,0],[.28,.11,.28],[Math.PI/2,0,0]),C('hub',cream,[0,0,.075],[.08,.08,.08],[Math.PI/2,0,0]),...Array.from({length:5},(_,j)=>{const a=j/5*Math.PI*2;return C('hole_'+j,cream,[Math.cos(a)*.18,Math.sin(a)*.18,.06],[.055,.015,.055],[Math.PI/2,0,0]);})],[x,1.77,0]))
]);
expansionAssets.cinema_chair=G('cinema_chair',[
 B('seat', '#b87368',[0,.52,0],[.65,.17,.62]),B('back','#c2867a',[0,.94,-.29],[.67,.79,.16],[.10,0,0]),
 ...[-1,1].map(x=>B('arm_'+x,wood,[x*.37,.70,0],[.08,.12,.73])),...[-1,1].flatMap(x=>[-1,1].map(z=>B('leg_'+x+z,dark,[x*.25,.24,z*.21],[.055,.48,.055])))
]);
expansionAssets.grain=G('grain',[
 C('stem','#b99f60',[0,.37,0],[.027,.74,.027]),P('head','bud','#e4c17b',[0,.83,0],[.11,.23,.10]),
 P('leaf','bud','#a9b87e',[.13,.32,0],[.21,.04,.07],[0,0,.45])
]);
expansionAssets.windmill=G('windmill',[
 C('tower','#eed9b5',[0,1.8,0],[.81,3.6,.81]),P('roof','cone','#c47e62',[0,4.0,0],[1.05,1.15,1.05]),
 G('sails',[...Array.from({length:4},(_,i)=>G('sail_'+i,[B('spar',wood,[0,.93,0],[.08,2.30,.08]),B('canvas',cream,[.25,1.14,.02],[.47,1.22,.065])],[0,0,0],[0,0,i*Math.PI/2])),C('hub',gold,[0,0,.12],[.17,.24,.17],[Math.PI/2,0,0])],[0,3.0,.87])
]);
expansionAssets.chime=G('chime',[
 B('post',wood,[0,1.0,0],[.17,2.0,.17]),B('arm',wood,[.22,1.96,0],[.75,.10,.12]),
 G('swing',[C('string',cream,[0,-.13,0],[.015,.26,.015]),C('chime_tube',gold,[0,-.44,0],[.12,.40,.12]),P('clapper','bud',dark,[0,-.72,0],[.075,.075,.075])],[.44,1.90,0]),
 B('name_plate',green,[0,1.05,.10],[.47,.28,.08])
]);
expansionAssets.clay_basket=G('clay_basket',[
 P('basket','cup',wood,[0,.23,0],[.45,.46,.38]),P('rim','torus','#cfac7d',[0,.47,0],[.46,.12,.40]),
 ...[[-.14,0],[.16,.10],[.03,-.17]].map((p,i)=>P('clay_'+i,'pebble','#c39278',[p[0],.47,p[1]],[.20,.17,.18]))
]);
expansionAssets.seed_packets=G('seed_packets',[
 B('crate',wood,[0,.18,0],[.93,.36,.55]),...[-1,0,1].map((x,i)=>G('packet_'+i,[B('paper',cream,[0,0,0],[.21,.37,.08]),P('flower','bud',['#dfad8c','#c5b675','#95b29c'][i],[0,.02,.051],[.07,.075,.02])],[x*.26,.43,0],[0,0,x*-.08]))
]);
expansionAssets.bread=G('bread',[
 P('bun','smooth','#dfb275',[0,.12,0],[.30,.19,.22]),...[-1,0,1].map(x=>B('score_'+x,cream,[x*.12,.285,0],[.045,.012,.23],[0,.30,0]))
]);
expansionAssets.lantern=G('lantern',[
 C('base',dark,[0,.06,0],[.16,.12,.16]),C('glass','#f0cb86',[0,.28,0],[.13,.35,.13]),P('cap','cone',green,[0,.53,0],[.20,.20,.20]),
 P('handle','torus',dark,[0,.70,0],[.10,.038,.10],[Math.PI/2,0,0])
]);
expansionAssets.trail_pin=G('trail_pin',[
 C('enamel',gold,[0,0,0],[.13,.038,.13],[Math.PI/2,0,0]),P('leaf','smooth',green,[0,0,.035],[.06,.09,.018])
]);
expansionAssets.shop_canopy=G('shop_canopy',[
 ...[-1,1].map(x=>B('post_'+x,wood,[x*1.62,1.55,0],[.11,3.1,.11])),B('awning','#d59880',[0,2.70,.70],[3.55,.13,1.7],[.13,0,0]),
 ...Array.from({length:8},(_,i)=>B('stripe_'+i,cream,[-1.54+i*.44,2.79,.70],[.22,.025,1.70],[.13,0,0])),
 B('counter',green,[0,.57,0],[3.0,1.14,1.08]),B('counter_top',wood,[0,1.19,0],[3.15,.14,1.21])
]);
expansionAssets.archive_hut=G('archive_hut',[
 B('back_wall','#d1b894',[0,1.15,-2.24],[5.4,2.3,.14]),B('left_wall','#e2c9a1',[-2.66,.62,0],[.13,1.24,4.5]),
 B('window_frame',cream,[0,1.4,-2.12],[1.48,1.18,.12]),B('window','#8eaca3',[0,1.4,-2.02],[1.21,.92,.07]),B('crossbar',cream,[0,1.4,-1.97],[.065,.93,.04]),
 P('cutaway_roof','roof','#86a68d',[0,2.25,-1.49],[5.95,1.65,1.70]),...[-1,1].map(x=>B('front_post_'+x,wood,[x*2.57,1.3,1.99],[.14,2.6,.14]))
]);
expansionAssets.ridge_stone=G('ridge_stone',[
 P('base','pebble','#9fa39b',[0,.37,0],[1.1,.60,.82]),P('face','pebble','#babbaa',[.20,.68,-.2],[.84,.57,.68]),P('moss','pebble','#98ac89',[-.38,.74,.27],[.52,.20,.39])
]);
expansionAssets.glazed_mug=G('glazed_mug',[
 P('cup','cup','#8fac9a',[0,.23,0],[.28,.46,.28]),P('rim','torus',cream,[0,.465,0],[.28,.075,.28]),
 C('inside','#608577',[0,.453,0],[.19,.017,.19]),P('handle','torus','#8fac9a',[.31,.26,0],[.21,.08,.21],[Math.PI/2,0,0]),P('stamp','bud',gold,[0,.25,.263],[.066,.070,.013])
]);

export { expansionAssets };
