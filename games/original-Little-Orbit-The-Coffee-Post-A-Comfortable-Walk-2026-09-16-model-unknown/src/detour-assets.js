/** Reproducible Open Doors model kit. Stable names are animation controls.
 * Export with tools/export-detours.mjs. All units are metres, Y up, front +Z. */
const G=(name,children,p=[0,0,0],r=[0,0,0])=>({name,children,p,r,painted:true});
const P=(name,shape,color,p,s,r=[0,0,0])=>({name,shape,color,p,s,r,painted:true});
const B=(n,c,p,s,r)=>P(n,'rounded_box',c,p,s,r);
const S=(n,c,p,s,r)=>P(n,'painted_small',c,p,s,r);
const C=(n,c,p,s,r)=>P(n,'cylinder',c,p,s,r);
const wood='#ad825e',cream='#f7e8c8',ink='#415752',green='#678f80',gold='#e6bc74',rose='#cc8d79';
const detourAssets={};
detourAssets.postcard_press=G('postcard_press',[
 B('bench',wood,[0,.91,0],[1.9,.16,1.1]),...[-.76,.76].flatMap(x=>[-.36,.36].map(z=>B('leg_'+x+'_'+z,ink,[x,.44,z],[.12,.87,.13]))),
 B('paper',cream,[0,1.015,.04],[1.03,.025,.75]),B('frame',green,[0,1.87,-.31],[1.39,.18,.20]),
 ...[-.63,.63].map(x=>C('press_pillar_'+x,gold,[x,1.43,-.3],[.046,.93,.046])),
 G('press_arm',[B('platen',green,[0,0,0],[1.0,.15,.53]),C('screw',gold,[0,.34,-.22],[.053,.75,.053]),B('cross_handle',rose,[0,.70,-.22],[.7,.09,.12])],[0,1.36,-.03]),
 G('printed_card',[B('card',cream,[0,0,0],[.91,.025,.65]),P('leaf_mark','rounded_ear',green,[0,.018,0],[.22,.014,.15],[Math.PI/2,0,.55]),C('stamp',rose,[.29,.02,-.21],[.079,.014,.079])],[0,1.04,.04])
]);
detourAssets.toy_orrery=G('toy_orrery',[
 C('base',wood,[0,.12,0],[.72,.24,.62]),C('stem',gold,[0,.53,0],[.07,.76,.07]),
 G('world_turn',[S('planet',green,[0,.10,0],[.42,.42,.42]),S('island',cream,[.12,.33,.14],[.21,.16,.20]),P('orbit','torus',gold,[0,.10,0],[.72,.16,.72],[.25,0,.30]),
 G('moon_turn',[B('moon_arm',gold,[.39,0,0],[.80,.035,.055]),S('moon',cream,[.78,0,0],[.13,.13,.13])],[0,.13,0])],[0,1.06,0]),
 G('wind_key',[C('axle',gold,[0,0,0],[.05,.22,.05],[Math.PI/2,0,0]),S('key_left',rose,[-.1,0,.13],[.14,.09,.04]),S('key_right',rose,[.1,0,.13],[.14,.09,.04])],[0,.29,.62])
]);
detourAssets.garden_pump=G('garden_pump',[
 B('foot',wood,[0,.09,0],[.8,.18,.7]),C('pump_body',green,[0,.66,0],[.20,1.0,.20]),C('cap',gold,[0,1.18,0],[.28,.12,.28]),
 G('pump_handle',[B('arm',green,[.25,0,0],[.69,.09,.1]),S('grip',rose,[.56,0,0],[.16,.08,.10])],[0,1.28,0]),
 C('spout',gold,[0,.92,.27],[.065,.57,.065],[Math.PI/2,0,0]),C('spout_tip',gold,[0,.82,.5],[.07,.22,.07]),
 P('flow','cylinder','#b2d8cc',[0,.47,.51],[.032,.49,.032])
]);
detourAssets.glasshouse_frame=G('glasshouse_frame',[
 ...[-2.62,2.62].map(x=>B('sill_'+x,wood,[x,.28,0],[.13,.17,5.2])),
 ...[-2.52,-.85,.85,2.52].flatMap((z,iz)=>[
 ...[-1,1].map(s=>B('upright_'+iz+'_'+s,green,[s*2.62,1.49,z],[.10,2.40,.10])),
 ...Array.from({length:12},(_,i)=>{const a=(i+.5)/12*Math.PI;return B('arch_'+iz+'_'+i,cream,[Math.cos(a)*2.62,2.67+Math.sin(a)*1.3,z],[.69,.075,.10],[0,0,Math.atan2(-1.3*Math.cos(a),2.62*Math.sin(a))]);})]),
 B('ridge',green,[0,3.97,0],[.12,.12,5.4]),
 ...[-1,1].flatMap(s=>[-1.69,0,1.69].map((z,i)=>B('glass_panel_'+s+'_'+i,'#b8d4c2',[s*2.59,1.05,z],[.045,1.32,1.58]))),
 ...[-1,1].map(s=>B('door_frame_'+s,cream,[s*.97,1.36,2.63],[.12,2.6,.12])),B('door_lintel',cream,[0,2.66,2.63],[2.04,.12,.12])
]);
detourAssets.seed_pod=G('seed_pod',[
 C('stem',green,[0,.41,0],[.037,.81,.037]),S('leaf_left',green,[-.19,.33,0],[.28,.055,.15],[0,0,-.25]),S('leaf_right','#9aaf79',[.21,.50,0],[.29,.06,.15],[0,0,.30]),
 G('pod',[S('shell',gold,[0,0,0],[.19,.24,.19]),...Array.from({length:5},(_,i)=>{const a=i/5*Math.PI*2;return S('petal_'+i,cream,[Math.cos(a)*.17,.03,Math.sin(a)*.17],[.15,.08,.19]);})],[0,.90,0])
]);
detourAssets.leaf_basin=G('leaf_basin',[
 C('base','#c4c4ad',[0,.17,0],[1.03,.34,.77]),P('rim','torus',cream,[0,.45,0],[1.02,.49,.76]),C('water','#91b9b0',[0,.51,0],[.7,.035,.52]),
 G('leaf_boat',[P('leaf','rounded_ear',gold,[0,0,0],[.24,.06,.15],[0,0,0]),B('mast',wood,[0,.13,0],[.014,.23,.015]),P('sail','rounded_ear',cream,[0,.20,0],[.07,.11,.012])],[.1,.55,.05])
]);
detourAssets.tile_rack=G('tile_rack',[
 ...[-.78,.78].map(x=>B('post_'+x,wood,[x,.97,0],[.13,1.94,.16])),
 ...[.22,.91,1.62].map((y,i)=>B('ledge_'+i,wood,[0,y,0],[1.88,.14,.41])),
 ...Array.from({length:6},(_,i)=>B('tile_'+i,[green,rose,gold][i%3],[(i%3-1)*.51,.58+Math.floor(i/3)*.71,.02],[.43,.51,.105],[0,0,Math.PI/15*(i%2-.5)])),
 B('brush',cream,[.46,.25,.20],[.51,.032,.04],[0,.4,0])
]);
detourAssets.fern_press=G('fern_press',[
 B('table',wood,[0,.92,0],[1.65,.14,1.1]),...[-.65,.65].flatMap(x=>[-.34,.34].map(z=>B('leg_'+x+'_'+z,ink,[x,.44,z],[.11,.88,.11]))),
 B('book',green,[0,1.03,0],[1.22,.10,.83]),B('page',cream,[0,1.10,0],[1.12,.02,.73]),
 G('fern_print',[C('stem',green,[0,.014,0],[.013,.55,.013],[Math.PI/2,0,0]),...Array.from({length:8},(_,i)=>P('leaf_'+i,'rounded_ear',green,[(i%2?1:-1)*.10,.02,(Math.floor(i/2)-1.5)*.12],[.13,.012,.065],[0,(i%2?1:-1)*.55,0]))],[0,1.12,0]),
 G('book_cover',[B('cover',green,[-.31,0,0],[.61,.035,.83])],[0,1.14,0])
]);
detourAssets.shadow_theatre=G('shadow_theatre',[
 B('stand',wood,[0,.6,0],[.14,1.2,.2]),B('foot',wood,[0,.08,0],[1.50,.15,.80]),
 B('frame',rose,[0,1.76,0],[2.16,1.58,.37]),B('screen',cream,[0,1.76,.204],[1.82,1.21,.029]),
 G('sky_wheel',[S('moon',gold,[.58,0,0],[.17,.17,.014]),S('bird',ink,[-.46,.04,0],[.14,.074,.019]),S('wing',ink,[-.47,.12,0],[.06,.14,.018],[0,0,-.6])],[0,1.80,.238]),
 B('hills',green,[0,1.29,.256],[1.79,.23,.034]),
 G('crank',[C('axis',gold,[0,0,0],[.06,.24,.06],[0,0,Math.PI/2]),B('handle',wood,[.14,.13,0],[.10,.30,.10]),S('grip',green,[.16,.29,0],[.13,.07,.075])],[1.12,1.31,0])
]);
detourAssets.cairn_stack=G('cairn_stack',[
 S('base','#b9b8a3',[0,.12,0],[.67,.18,.49]),S('stone_0','#d9cbb2',[0,.36,0],[.43,.20,.35]),S('stone_1','#95a99e',[.01,.67,0],[.32,.18,.29]),S('stone_2','#ddb688',[-.04,.94,0],[.22,.14,.21])
]);
detourAssets.shop_front=G('shop_front',[
 B('back_wall','#d8baa0',[0,1.34,-1.43],[3.2,2.65,.16]),
 ...[-1.58,1.58].map(x=>B('side_wall_'+x,'#e8cdb0',[x,.67,-.45],[.14,1.35,2.08])),
 B('counter',green,[0,.53,-.42],[2.8,1.04,.89]),B('counter_top',wood,[0,1.09,-.42],[2.96,.15,1.05]),
 B('window_frame',cream,[0,1.94,-1.30],[1.26,1.03,.08]),B('window',green,[0,1.94,-1.24],[1.03,.81,.035]),B('window_bar',cream,[0,1.94,-1.20],[.053,.87,.029]),
 ...[-1.58,1.58].map(x=>C('awning_post_'+x,wood,[x,1.41,1.14],[.058,2.82,.058])),
 B('canopy',rose,[0,2.79,.62],[3.5,.11,1.78],[.09,0,0]),...Array.from({length:7},(_,i)=>B('awning_stripe_'+i,cream,[-1.47+i*.49,2.852,.62],[.22,.028,1.78],[.09,0,0]))
]);
detourAssets.fern_cluster=G('fern_cluster',Array.from({length:7},(_,i)=>{
 const a=(i/7)*Math.PI*2;return G('frond_'+i,Array.from({length:5},(_,j)=>P('leaf_'+j,'rounded_ear',i%2?green:'#8ca47b',[.08*j,.10+j*.075,0],[.11,.08,.055],[0,0,-.3])),[0,0,0],[0,a,0]);
}));

export { detourAssets };
