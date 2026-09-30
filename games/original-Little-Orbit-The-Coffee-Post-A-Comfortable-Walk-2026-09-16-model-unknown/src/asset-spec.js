import { detourAssets } from './detour-assets.js';
import { courierSpec, coffeeSpec } from './courier-spec.js';
import { lifeAssets } from './life-assets.js';
import { expansionAssets } from './expansion-assets.js';
/* Authoring source. Exported to editable glTF and to Blender with tools/build.mjs. */
const C={cream:'#fff1d1',white:'#fff9ee',ink:'#303e3c',orange:'#df8657',teal:'#547e72',pink:'#eab4af',wood:'#aa7955',darkwood:'#765547',green:'#86a66c',leaf:'#bdc984',yellow:'#efc775'};
const part=(name,shape,color,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>({name,shape,color,p,s,r});
const group=(name,children,p=[0,0,0],r=[0,0,0])=>({name,children,p,r});
const ball=(name,col,p,s)=>part(name,'smooth',col,p,s);
const box=(name,col,p,s,r)=>part(name,'box',col,p,s,r);
const cyl=(name,col,p,s,r)=>part(name,'cylinder',col,p,s,r);
const specs={};
function basePet(name,col,kind){const ch=[];
 ch.push(ball('body',col,[0,.73,0],[.52,.64,.43]));
 ch.push(ball('head',col,[0,1.26,.065],[.6,.51,.49]));
 ch.push(group('leg_L',[ball('foot_L',col,[0,0,.05],[.22,.15,.28])],[-.27,.15,0]));
 ch.push(group('leg_R',[ball('foot_R',col,[0,0,.05],[.22,.15,.28])],[.27,.15,0]));
 ch.push(group('arm_L',[ball('hand_L',col,[0,-.17,0],[.17,.3,.18])],[-.57,.87,.02],[0,0,-.3]));
 ch.push(group('arm_R',[ball('hand_R',col,[0,-.17,0],[.17,.3,.18])],[.57,.87,.02],[0,0,.3]));
  ch.push(ball('muzzle',kind==='frog'?'#cfe4b0':C.cream,[0,1.14,.464],[.33,.22,.095]));
  for(const x of [-.21,.21]){ch.push(ball('eye_'+x,C.ink,[x,1.36,.494],[.054,.073,.025]));ch.push(ball('cheek_'+x,C.pink,[x*1.65,1.15,.465],[.087,.045,.025]));}
  ch.push(ball('nose',kind==='frog'?'#64877a':C.darkwood,[0,1.22,.553],[.061,.045,.026]));
  ch.push(part('collar','torus',kind==='fox'?C.teal:C.orange,[0,.92,0],[.48,.19,.41]));
 if(kind==='rabbit'){for(const x of [-.26,.26]){ch.push(ball('ear_'+x,col,[x,1.94,0],[.16,.54,.14]));ch.push(ball('inner_ear_'+x,C.pink,[x,1.96,.112],[.08,.37,.044]));}ch.push(ball('tail',C.white,[0,.52,-.45],[.2,.2,.2]));}
 if(kind==='cat'||kind==='fox'){
  for(const x of [-.38,.38]){ch.push(part('ear_'+x,'cone',col,[x,1.72,0],[.25,.52,.22],[0,0,x>0?-.25:.25]));ch.push(part('inner_ear_'+x,'cone',C.pink,[x,1.76,.125],[.13,.27,.10],[0,0,x>0?-.25:.25]));}
  ch.push(group('tail',[ball('tail_base',col,[0,.15,0],[.25,.55,.24]),ball('tail_tip',kind==='fox'?C.cream:col,[0,.56,0],[.23,.25,.23])],[.40,.35,-.41],[.7,0,-.6]));
 }
 if(kind==='frog'){for(const x of [-.36,.36])ch.push(ball('eye_bump_'+x,col,[x,1.65,.12],[.25,.24,.22]));ch.push(ball('belly','#cfe4b0',[0,.65,.366],[.38,.40,.08]));}
 return group(name,ch);
}
specs.codey=courierSpec;
specs.coffee=coffeeSpec;
specs.fox=basePet('fox','#d99564','fox');
specs.cat=basePet('cat','#87969d','cat');
specs.rabbit=basePet('rabbit','#f6dfca','rabbit');
specs.frog=basePet('frog','#93b893','frog');
specs.machine=group('machine',[
 box('body',C.teal,[0,1.15,0],[1.35,1.45,.8]),box('foot',C.darkwood,[0,.18,0],[1.65,.36,1.05]),box('cream_top',C.cream,[0,1.93,0],[1.52,.17,.91]),box('front',C.ink,[0,1.19,.414],[1.1,.66,.055]),box('drip_tray',C.cream,[0,.65,.55],[1.28,.08,.57]),
 cyl('dial',C.cream,[.34,1.52,.47],[.16,.06,.16],[Math.PI/2,0,0]),cyl('dial_inner',C.orange,[.34,1.52,.51],[.09,.05,.09],[Math.PI/2,0,0]),
 cyl('left_nozzle',C.cream,[-.3,1.2,.63],[.09,.39,.09]),cyl('right_nozzle',C.cream,[.25,1.2,.63],[.09,.39,.09]),
 cyl('bean_hopper',C.darkwood,[-.35,2.1,-.08],[.22,.28,.22]),part('hopper_lid','cone',C.orange,[-.35,2.3,-.08],[.25,.2,.25]),
 box('switch',C.orange,[-.48,1.52,.48],[.10,.18,.055]),cyl('steam_arm',C.cream,[.81,1.21,.19],[.05,.64,.05],[0,0,-.3])]);
specs.oak=group('oak',[
 cyl('trunk',C.wood,[0,1.45,0],[.24,2.9,.24]),cyl('branch',C.wood,[.5,2.1,0],[.15,1.4,.15],[0,0,-.65]),
 part('leaf_main','pebble','#9eae77',[0,3.2,0],[1.7,1.45,1.45]),part('leaf_left','pebble','#aec080',[-1.05,2.76,.15],[1.25,1.05,1.15]),part('leaf_right','pebble','#b9c98b',[1.10,2.94,.05],[1.2,1.15,1.1]),part('leaf_top','pebble','#c4d194',[.35,3.92,-.15],[1.10,.8,.94])]);
specs.apricot=JSON.parse(JSON.stringify(specs.oak));specs.apricot.name='apricot';specs.apricot.children.filter(p=>p.name.startsWith('leaf')).forEach(p=>p.color='#b8be76');for(const [i,p] of [[0,[-.9,2.5,1]],[1,[.5,3.3,1.3]],[2,[1.5,2.6,.4]],[3,[-.7,3.4,-1.2]],[4,[.2,2.3,-1.2]]])specs.apricot.children.push(ball('fruit_'+i,C.orange,p,[.18,.20,.18]));
specs.pine=group('pine',[cyl('trunk',C.wood,[0,1.6,0],[.18,3.2,.18]),part('low_needles','cone','#6f9680',[0,2.1,0],[1.28,2.1,1.28]),part('middle_needles','cone','#81a58b',[0,3.03,0],[1.02,1.96,1.02]),part('top_needles','cone','#a3bb95',[0,3.9,0],[.75,1.72,.75])]);
specs.bench=group('bench',[box('seat',C.wood,[0,.58,0],[1.9,.15,.65]),box('back_low',C.wood,[0,.93,-.27],[1.9,.20,.1]),box('back_high',C.wood,[0,1.22,-.27],[1.9,.20,.1]),...[-.72,.72].flatMap(x=>[box('leg_'+x,C.teal,[x,.29,0],[.12,.58,.57]),box('back_post_'+x,C.teal,[x,.88,-.3],[.1,.75,.1])])]);
specs.lamp=group('lamp',[cyl('post',C.teal,[0,1.4,0],[.085,2.8,.085]),cyl('base',C.teal,[0,.13,0],[.23,.26,.23]),box('lamp_glass',C.yellow,[0,2.83,0],[.38,.48,.38]),part('lamp_roof','cone',C.teal,[0,3.16,0],[.38,.29,.38]),...[-1,1].flatMap(x=>[-1,1].map(z=>box('frame_'+x+z,C.teal,[x*.20,2.83,z*.20],[.055,.51,.055]))) ]);
specs.mushroom=group('mushroom',[cyl('stem',C.cream,[0,.35,0],[.17,.7,.17]),ball('cap',C.orange,[0,.73,0],[.62,.29,.58]),...[[.22,.94,.14],[-.27,.92,.03],[.09,.94,-.29]].map((p,i)=>ball('spot_'+i,C.cream,p,[.1,.031,.09]))]);
specs.flower=group('flower',[cyl('stem','#6f8f64',[0,.25,0],[.023,.5,.023]),...Array.from({length:5},(_,i)=>ball('petal_'+i,C.cream,[Math.cos(i/5*Math.PI*2)*.135,.5,Math.sin(i/5*Math.PI*2)*.135],[.135,.05,.135])),ball('center',C.yellow,[0,.53,0],[.08,.065,.08]),ball('leaf','#8dac72',[.08,.2,.02],[.13,.035,.06])]);
specs.bell=group('bell',[box('post_L',C.wood,[-.9,1.65,0],[.20,3.3,.20]),box('post_R',C.wood,[.9,1.65,0],[.20,3.3,.20]),box('cross_bar',C.wood,[0,3.23,0],[2.3,.20,.27]),group('swing',[part('bell_body','cup',C.yellow,[0,-.35,0],[.42,.65,.42],[Math.PI,0,0]),part('bell_rim','torus',C.orange,[0,-.69,0],[.45,.14,.45]),ball('clapper',C.darkwood,[0,-.72,0],[.1,.12,.1]),cyl('rope',C.cream,[0,-1.24,0],[.025,1.1,.025])],[0,2.9,0])]);
specs.mailbox=group('mailbox',[box('post',C.wood,[0,.6,0],[.17,1.2,.17]),box('box',C.orange,[0,1.2,0],[.65,.55,.7]),ball('round_top',C.orange,[0,1.47,0],[.325,.24,.35]),box('slot',C.ink,[0,1.35,.356],[.40,.055,.02]),box('flag',C.cream,[.41,1.55,0],[.22,.14,.06]),box('flag_post',C.cream,[.32,1.3,0],[.05,.58,.06])]);
specs.boat=group('boat',[part('hull','roof',C.cream,[0,.2,0],[.7,.35,1.4],[0,0,Math.PI]),cyl('mast',C.wood,[0,.58,0],[.035,1.1,.035]),part('sail','cone',C.orange,[.15,.8,0],[.28,.57,.07],[0,0,-.32])]);
specs.sign=group('sign',[box('post',C.wood,[0,.8,0],[.14,1.6,.14]),box('board',C.cream,[0,1.65,0],[2,.60,.14])]);
specs.stool=group('stool',[cyl('seat',C.orange,[0,.66,0],[.35,.12,.35]),...[-1,1].flatMap(x=>[-1,1].map(z=>box('leg'+x+z,C.wood,[x*.19,.31,z*.19],[.075,.62,.075]))) ]);
specs.pot=group('pot',[part('pot','cup',C.orange,[0,.28,0],[.30,.56,.30]),cyl('soil',C.darkwood,[0,.56,0],[.265,.03,.265]),ball('leaf1',C.green,[-.13,.76,0],[.12,.28,.12]),ball('leaf2',C.leaf,[.14,.88,.05],[.15,.36,.15]),ball('leaf3',C.teal,[0,.79,-.12],[.12,.27,.10])]);
specs.book=group('book',[box('pages',C.cream,[0,.12,0],[.35,.2,.45]),box('cover',C.teal,[0,.23,0],[.40,.04,.48]),box('bottom_cover',C.teal,[0,.01,0],[.40,.04,.48]),box('spine',C.teal,[-.19,.12,0],[.04,.25,.48])]);


// Small flower parts stay low-poly. Character faces keep the smooth mesh.
for(const p of specs.flower.children)if(p.shape==='smooth')p.shape='bud';

// Keep a pet's face and ears attached when its head turns.
for(const key of ['fox','cat','rabbit','frog']){
 const pet=specs[key],pivot=[0,1.26,.065],headParts=[];
 pet.children=pet.children.filter(p=>{
  if(!/^(head|muzzle|eye_|cheek_|nose|ear_|inner_ear_)/.test(p.name))return true;
  if(p.name==='head')p.name='head_shell';
  p.p=(p.p||[0,0,0]).map((v,i)=>v-pivot[i]);headParts.push(p);return false;
 });
 headParts.push(part('mouth_smile','smile_curve',C.ink,[0,-.145,.505],[.10,.13,.17]));
 pet.children.push(group('head',headParts,pivot));pet.painted=true;
}

Object.assign(specs,expansionAssets);

Object.assign(specs,lifeAssets);

Object.assign(specs,detourAssets);

export { specs, C };
