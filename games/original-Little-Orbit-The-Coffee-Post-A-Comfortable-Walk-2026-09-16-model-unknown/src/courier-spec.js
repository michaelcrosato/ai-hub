/** Courier authoring data. +Y is up. +Z is the face and the tray.
 * Names are the animation contract. Change sizes and paint without changing names.
 * All model parts and paint colors are exported to the editable Blender library.
 */
const COURIER_PALETTE={fur:'#db945e',lightFur:'#e5a269',shadowFur:'#c48054',cream:'#fff0d2',eye:'#483b35',pink:'#e8b2a0',cheek:'#dc9b7a',green:'#577b68',greenLight:'#76917b',greenDark:'#3e5e52',wood:'#b48760',edge:'#966846',terra:'#c86f49'};
const COFFEE_SLOTS=[[-.30,.083,-.235],[.30,.083,-.235],[-.30,.083,.235],[.30,.083,.235]];
const P=COURIER_PALETTE;
const part=(name,shape,color,p,s,r=[0,0,0])=>({name,shape,color,p,s,r});
const group=(name,children,p=[0,0,0],r=[0,0,0])=>({name,children,p,r});
const ball=(name,col,p,s)=>part(name,'painted_small',col,p,s);
const soft=(name,col,p,s,r)=>part(name,'rounded_box',col,p,s,r);
const cyl=(name,col,p,s,r)=>part(name,'cylinder',col,p,s,r);
const smile=(name,p,s,r)=>part(name,'smile_curve',P.eye,p,s,r);

const coffeeSpec=group('coffee',[
 part('paper_cup','coffee_cup',P.cream,[0,.225,0],[.19,.39,.19]),
 part('paper_sleeve','coffee_cup','#d7b184',[0,.20,0],[.182,.17,.182]),
 part('lid_lower','coffee_lid',P.cream,[0,.428,0],[.207,.055,.207]),
 part('lid_top','coffee_lid','#fff8e9',[0,.468,0],[.182,.041,.182]),
 part('lid_soft_edge','torus','#fff8e9',[0,.443,0],[.207,.078,.207]),
 soft('sip_opening',P.edge,[0,.493,-.09],[.087,.012,.038]),
 cyl('cup_badge',P.cream,[0,.207,.184],[.064,.012,.064],[Math.PI/2,0,0]),
 ball('coffee_bean',P.terra,[0,.207,.197],[.037,.050,.009]),
 soft('bean_line',P.cream,[0,.207,.207],[.010,.064,.005],[0,0,-.42]),
]);
coffeeSpec.painted=true;

const face=[];
face.push(part('head_shell','painted_sphere',P.fur,[0,.05,0],[.735,.605,.55]));
for(const side of [-1,1]){
 const id=side<0?'L':'R';
 face.push(group('ear_'+id,[
  part('outer_ear_'+id,'rounded_ear',P.fur,[0,0,0],[.315,.37,.235]),
  part('inner_ear_'+id,'rounded_ear',P.pink,[0,.015,.152],[.179,.246,.080]),
 ],[side*.47,.525,-.055],[0,0,-side*.30]));
}
face.push(part('muzzle','painted_sphere',P.cream,[0,-.175,.465],[.505,.278,.157]));
for(const side of [-1,1]){
 const id=side<0?'L':'R',x=side*.247;
 face.push(group('eye_'+id,[
  ball('pupil_'+id,P.eye,[0,0,0],[.064,.096,.034]),
  ball('eye_glint_'+id,'#fff6e0',[-.014,.033,.028],[.018,.024,.009]),
 ],[x,.074,.535]));
 const happy=group('happy_eye_'+id,[smile('happy_arc_'+id,[0,0,0],[.073,.097,.24],[0,0,Math.PI])],[x,.050,.551]);
 happy.visible=false;face.push(happy);
 face.push(ball('cheek_'+id,P.cheek,[side*.499,-.103,.409],[.09,.044,.032]));
 for(let j=0;j<2;j++)face.push(soft('whisker_'+id+j,P.eye,[side*(.577-j*.016),-.090-j*.108,.328+j*.031],[.114,.026,.027],[0,-side*.45,side*(j?-.36:.15)]));
}
face.push(ball('nose',P.eye,[0,-.118,.625],[.068,.045,.039]));
face.push(soft('nose_stem',P.eye,[0,-.175,.635],[.025,.062,.024]));
face.push(group('mouth_smile',[
 smile('smile_L',[-.079,0,0],[.088,.125,.19]),smile('smile_R',[.079,0,0],[.088,.125,.19]),
],[0,-.213,.627]));
const happyMouth=group('mouth_happy',[
 part('open_smile','happy_mouth',P.eye,[0,0,0],[.132,.103,.026]),
 ball('tongue',P.pink,[0,-.047,.022],[.069,.032,.012]),
],[0,-.213,.632]);happyMouth.visible=false;face.push(happyMouth);

const courierSpec=group('codey',[
 part('body','painted_sphere',P.fur,[0,.785,0],[.50,.61,.425]),
 ball('bib',P.cream,[0,.90,.34],[.37,.34,.117]),
 // All face parts use one head pivot.
 group('head',face,[0,1.54,.045]),
 group('leg_L',[ball('foot_L',P.shadowFur,[0,-.055,.061],[.223,.205,.285])],[-.267,.237,.006]),
 group('leg_R',[ball('foot_R',P.shadowFur,[0,-.055,.061],[.223,.205,.285])],[.267,.237,.006]),
 group('arm_L',[ball('hand_L',P.fur,[0,-.235,.03],[.204,.306,.221])],[-.55,1.01,.11],[0,0,-.27]),
 group('arm_R',[ball('hand_R',P.fur,[0,-.235,.03],[.204,.306,.221])],[.55,1.01,.11],[0,0,.27]),
 group('tail',[
  part('tail_base','painted_sphere',P.fur,[0,.225,0],[.265,.49,.28]),
  part('tail_tip','painted_sphere',P.cream,[0,.591,0],[.237,.285,.250]),
 ],[-.35,.67,-.36],[-.65,0,.65]),
 soft('pack',P.green,[0,.82,-.422],[.83,.83,.37]),
 soft('pack_flap',P.greenLight,[0,1.02,-.63],[.75,.38,.10]),
 soft('pack_pocket',P.green,[0,.71,-.648],[.55,.31,.10]),
 cyl('pack_badge',P.cream,[0,1.025,-.693],[.103,.025,.103],[Math.PI/2,0,0]),
 soft('badge_stripe',P.green,[0,1.02,-.710],[.20,.023,.012],[0,0,-.43]),
 ...[-1,1].flatMap(side=>[
  ball('shoulder_strap_'+side,P.green,[side*.387,1.00,.12],[.080,.413,.306]),
  soft('strap_buckle_'+side,P.cream,[side*.385,.91,.405],[.095,.104,.035]),
 ]),
 group('tray',[
  soft('tray_base',P.wood,[0,0,0],[1.36,.145,1.02]),
  soft('tray_front',P.edge,[0,.085,.47],[1.36,.18,.105]),
  soft('tray_back',P.edge,[0,.07,-.47],[1.36,.15,.085]),
  soft('tray_left',P.wood,[-.635,.075,0],[.095,.16,.95]),
  soft('tray_right',P.wood,[.635,.075,0],[.095,.16,.95]),
  soft('tray_label',P.cream,[0,.088,.529],[.32,.092,.014]),
 ],[0,.76,.86]),
]);
courierSpec.painted=true;

export { COURIER_PALETTE, COFFEE_SLOTS, coffeeSpec, courierSpec };
