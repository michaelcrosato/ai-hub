/* The Last Signal — original room geometry, props, and lighting.
   World axes: x east, y south, z up. All art is rendered by my-3D2dge. */
(function(){
'use strict';
const E=My3D2dge, px=E.px;
const ROOMS={
 hall:{name:'Signal Hall',subtitle:'BLACKTIDE OBSERVATORY',w:300,h:220,camera:[-28,36,2.28,20],floor:'stone',wall:'#354448',accent:'#786b50',light:.46,
  props:[['table',75,48,42,25],['bench',230,178,62,20],['cabinet',280,48,28,52],['clock',44,15,17,12],['plant',36,178,15,15]],
  solids:[[54,35,96,61],[196,168,263,190],[263,25,296,74],[25,169,46,190]],
  doors:[{x:16,y:114,side:'W',to:'office',at:[264,156],name:"Keeper's Office"},{x:284,y:128,side:'E',to:'generator',at:[38,154],name:'Generator Room'},{x:155,y:15,side:'N',to:'gallery',at:[150,184],name:'Lens Gallery',lock:'power'},{x:152,y:205,side:'S',to:'exit',name:'Harbor door'}],
  objects:[{id:'hall-note',x:75,y:78,z:22,name:'Read the arrival note',kind:'note',note:'arrival'},{id:'hall-oil',x:249,y:156,z:20,name:'Take lamp oil',kind:'oil'}],lights:[[65,45,37,'#ffc77d',125],[281,121,48,'#abc9d0',80]]},
 office:{name:"Keeper's Office",subtitle:'WEST WING · SAFE ROOM',w:300,h:220,camera:[-23,38,2.35,20],floor:'wood',wall:'#465149',accent:'#8a7956',light:.26,
  props:[['desk',99,63,89,41],['chair',103,111,18,18],['shelf',200,19,69,26],['cot',61,172,82,32],['cabinet',256,50,29,42],['stove',24,70,25,25],['plant',244,191,14,14]],
  solids:[[54,42,144,84],[90,105,115,121],[165,5,236,32],[18,154,104,190],[240,27,272,73],[10,57,39,85],[232,181,255,204]],
  doors:[{x:284,y:158,side:'E',to:'hall',at:[36,114],name:'Signal Hall'}],
  objects:[{id:'office-desk',x:126,y:101,z:25,name:'Search the keeper’s desk',kind:'desk'},{id:'office-fuse',x:226,y:66,z:29,name:'Take the ceramic fuse',kind:'fuse'},{id:'office-journal',x:72,y:97,z:23,name:'Read the keeper’s log',kind:'note',note:'power'},{id:'office-rest',x:69,y:138,z:17,name:'Rest and refill the lamp',kind:'rest'}],lights:[[101,62,37,'#ffcb81',185],[24,70,29,'#f6b468',100]]},
 generator:{name:'Generator Room',subtitle:'EAST WING · SERVICE FLOOR',w:300,h:220,camera:[27,34,2.3,20],floor:'metal',wall:'#344244',accent:'#8b7f55',light:.5,
  props:[['generator',172,65,102,64],['barrel',61,31,24,24],['barrel',94,27,24,24],['workbench',246,155,68,30],['pipewall',22,25,25,45],['crate',65,186,34,25]],
  solids:[[119,32,224,100],[48,18,76,46],[80,14,109,43],[209,138,283,174],[5,8,38,47],[47,170,84,199]],
  doors:[{x:16,y:154,side:'W',to:'hall',at:[264,128],name:'Signal Hall'}],
  objects:[{id:'generator-panel',x:165,y:117,z:29,name:'Use the power controls',kind:'power'},{id:'generator-card',x:251,y:124,z:27,name:'Read the service card',kind:'note',note:'warning'},{id:'generator-ammo',x:91,y:179,z:18,name:'Take two cartridges',kind:'ammo'}],lights:[[177,70,57,'#e8b373',90],[245,156,39,'#9dc4b6',75]]},
 gallery:{name:'Lens Gallery',subtitle:'NORTH WING · TRANSIT HALL',w:300,h:220,camera:[-32,35,2.25,18],floor:'stone',wall:'#35484c',accent:'#9a875c',light:.48,
  props:[['orrery',150,97,52,48],['bench',246,155,65,21],['statue',48,44,27,27],['statue',248,40,27,27],['table',71,178,43,25]],
  solids:[[128,75,173,119],[210,142,284,169],[32,27,64,64],[232,23,264,58],[47,164,95,193]],
  doors:[{x:151,y:205,side:'S',to:'hall',at:[155,35],name:'Signal Hall'},{x:16,y:114,side:'W',to:'archive',at:[262,153],name:'The Archive'},{x:149,y:15,side:'N',to:'chamber',at:[145,182],name:'Signal Chamber',lock:'core'}],
  objects:[{id:'gallery-chart',x:197,y:64,z:23,name:'Read the transit chart',kind:'note',note:'bearing'},{id:'gallery-med',x:69,y:145,z:23,name:'Take a field dressing',kind:'med'}],lights:[[150,98,42,'#a0d6ce',105],[243,44,57,'#a7c0c9',90]]},
 archive:{name:'The Archive',subtitle:'NORTH WING · RESTRICTED COLLECTION',w:300,h:220,camera:[-25,39,2.3,23],floor:'wood',wall:'#354446',accent:'#85745b',light:.53,
  props:[['shelf',53,16,78,26],['shelf',151,16,74,26],['shelf',249,16,72,26],['shelf',289,75,19,69],['desk',109,123,73,34],['bells',88,62,54,18],['cabinet',242,84,36,42],['crate',41,181,43,32]],
  solids:[[12,3,93,31],[111,3,191,31],[209,3,290,31],[279,37,299,113],[70,104,147,144],[65,48,117,72],[221,60,263,104],[17,163,65,202]],
  doors:[{x:284,y:154,side:'E',to:'gallery',at:[36,114],name:'Lens Gallery'}],
  objects:[{id:'archive-song',x:165,y:122,z:24,name:'Read the watchkeeper’s song',kind:'note',note:'bells'},{id:'archive-bells',x:96,y:88,z:21,name:'Use the signal bells',kind:'bells'},{id:'archive-core',x:234,y:120,z:27,name:'Open the lens cabinet',kind:'core'},{id:'archive-oil',x:84,y:182,z:22,name:'Take lamp oil',kind:'oil'}],lights:[[102,123,36,'#dfb26e',140],[245,84,35,'#8bbcb0',70]]},
 chamber:{name:'Signal Chamber',subtitle:'THE CROWN · BEACON CONTROL',w:300,h:220,camera:[25,32,2.25,25],floor:'stone',wall:'#34494d',accent:'#a99060',light:.43,
  props:[['telescope',158,75,72,61],['console',214,140,72,29],['crate',59,164,30,30],['barrel',252,33,23,23],['plant',34,35,18,18]],
  solids:[[126,48,190,98],[174,122,250,158],[41,145,75,184],[237,19,266,49],[24,21,44,49]],
  doors:[{x:145,y:205,side:'S',to:'gallery',at:[149,35],name:'Lens Gallery'}],
  objects:[{id:'chamber-lens',x:211,y:178,z:26,name:'Align the beacon',kind:'lens'},{id:'chamber-note',x:73,y:133,z:25,name:'Read the final entry',kind:'note',note:'last'}],lights:[[159,77,59,'#a8d4cc',150],[215,140,36,'#e8b778',90]]}
};
function shade(c,f){const n=parseInt(c.slice(1),16),v=[n>>16,(n>>8)&255,n&255];return '#'+v.map(x=>Math.max(0,Math.min(255,Math.round(x*f))).toString(16).padStart(2,'0')).join('');}
function rnd(a,b){const t=Math.sin(a*127.1+b*311.7)*43758.5453;return t-Math.floor(t);}
function poly(r,g,points,c){px.poly(g,points.map(p=>r.w(p[0],p[1],p[2]||0)),c);}
function line(r,g,a,b,c,width=1){const A=r.w(...a),B=r.w(...b);px.line(g,A[0],A[1],B[0],B[1],c,width);}
function box(r,g,x,y,z,w,h,d,c,side){r.box(g,x-w/2,y-h/2,z,x+w/2,y+h/2,z+d,c,side||shade(c,.68));}
function disk(r,g,x,y,z,rad,c,n=32){poly(r,g,Array.from({length:n},(_,i)=>[x+Math.cos(i/n*Math.PI*2)*rad,y+Math.sin(i/n*Math.PI*2)*rad,z]),c);}
function ring(r,g,x,y,z,rad,c,n=48){for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;line(r,g,[x+Math.cos(a)*rad,y+Math.sin(a)*rad,z],[x+Math.cos(b)*rad,y+Math.sin(b)*rad,z],c);}}
function floor(r,g,R){
 const w=R.w,h=R.h;box(r,g,w/2,h/2,-9,w+9,h+9,9,'#263538','#152227');
 const tile=R.floor==='wood'?15:20;
 for(let x=0;x<w;x+=tile)for(let y=0;y<h;y+=R.floor==='wood'?50:20){let yy=Math.min(h,y+(R.floor==='wood'?50:20));let v=rnd(x,y),c=R.floor==='wood'?'#655b47':R.floor==='metal'?'#46514f':((x/20+y/20)%2?'#536365':'#627373');
 c=shade(c,.72+v*.33);poly(r,g,[[x,y,0],[x+tile-1,y,0],[x+tile-1,yy-1,0],[x,yy-1,0]],c);
 if(R.floor==='wood'){for(let j=0;j<3;j++)line(r,g,[x+3+j*4,y+3,0],[x+3+j*4,yy-3,0],shade(c,.86));}
 else if(R.floor==='metal'){line(r,g,[x+5,y+6,.2],[x+12,y+12,.2],shade(c,1.15));line(r,g,[x+8,y+4,.2],[x+15,y+10,.2],shade(c,1.15));}
 if(v>.75)line(r,g,[x+4,y+3,.2],[x+9,y+10,.2],shade(c,.7));
 }
 for(let i=0;i<2;i++)poly(r,g,[[5+i*4,5+i*4,.3],[w-5-i*4,5+i*4,.3],[w-5-i*4,7+i*4,.3],[5+i*4,7+i*4,.3]],R.accent);
 if(R.name==='Signal Hall'||R.name==='Lens Gallery'){
  poly(r,g,[[111,18,.5],[192,18,.5],[192,198,.5],[111,198,.5]],'#524b45');
  for(let x of [113,118,184,189])line(r,g,[x,20,.6],[x,196,.6],x%2?'#9a8562':'#776347');
  disk(r,g,151,110,.8,34,'#4c5959');ring(r,g,151,110,1,32,'#a18d68');ring(r,g,151,110,1,26,'#858672');
  for(let i=0;i<8;i++){let a=i*Math.PI/4;poly(r,g,[[151,110,1.2],[151+Math.cos(a-.12)*12,110+Math.sin(a-.12)*12,1.2],[151+Math.cos(a)*(i%2?24:31),110+Math.sin(a)*(i%2?24:31),1.2],[151+Math.cos(a+.12)*12,110+Math.sin(a+.12)*12,1.2]],i%2?'#758681':'#b5a379');}
 }
 if(R.floor==='metal'){for(let i=0;i<3;i++){const a=[[167+i*3,102,1],[169+i*3,164,1],[116+i*3,185,1],[30,185+i*3,1]];for(let k=1;k<a.length;k++)line(r,g,a[k-1],a[k],i===1?'#99784c':'#171e1d',2);}}
 // Damp patches and fragments stay deterministic, so the scene never shimmers.
 for(let i=0;i<22;i++){let x=15+rnd(i,55)*270,y=15+rnd(i,61)*190;if(i%3===0)disk(r,g,x,y,.6,3+rnd(i,15)*6,'#35474a',7);else line(r,g,[x,y,1],[x+4+rnd(i,80)*7,y-2,1],R.floor==='wood'?'#998267':'#92a19a');}
}
function windowOnBack(r,g,x,width,room){
 poly(r,g,[[x-3,0,17],[x+width+3,0,17],[x+width+3,0,78],[x-3,0,78]],'#131f23');
 poly(r,g,[[x,1,20],[x+width,1,20],[x+width,1,75],[x,1,75]],'#263e49');
 poly(r,g,[[x,1,20],[x+width,1,20],[x+width,1,45],[x,1,40]],'#33515d');
 for(let i=0;i<4;i++)line(r,g,[x,1,23+i*4],[x+width,1,23+i*4],'#405f68');
 for(let i=0;i<22;i++){let xx=x+rnd(i,x)*width,zz=22+rnd(i+20,x)*50;line(r,g,[xx,2,zz],[xx-1,2,zz-4],'#638088');}
 for(let i=0;i<=3;i++){let xx=x+i*width/3;line(r,g,[xx,3,19],[xx,3,77],'#13282c',3);line(r,g,[xx+1,3,19],[xx+1,3,77],'#6c807a',1);}
 for(let z of [19,46,77])line(r,g,[x-1,3,z],[x+width+1,3,z],'#71847d',2);
 box(r,g,x+width/2,2,16,width+9,9,4,'#637571');
 // Moonlight projected through the glass onto the floor.
 px.blend(g,.12,'normal',()=>poly(r,g,[[x,4,1],[x+width,4,1],[Math.min(298,x+width+80),159,1],[Math.min(298,x+70),159,1]],'#abc8c6'));
}
function rearWalls(r,g,R){
 let c=R.wall,H=86,w=R.w,h=R.h,side=r.view.yawDeg<0?w:0;
 poly(r,g,[[0,0,0],[w,0,0],[w,0,H],[0,0,H]],c);
 poly(r,g,[[side,0,0],[side,h,0],[side,h,H],[side,0,H]],shade(c,.85));
 for(let z=4;z<86;z+=11){line(r,g,[0,.2,z],[w,.2,z],shade(c,.84));line(r,g,[side,0,z],[side,h,z],shade(c,.65));}
 for(let x=0;x<=w;x+=30)for(let z=11;z<86;z+=22){let xx=x+(z%22?15:0);if(xx<w)line(r,g,[xx,.3,z],[xx,.3,z+11],shade(c,.86));}
 poly(r,g,[[0,1,0],[w,1,0],[w,1,20],[0,1,20]],shade(c,.67));
 for(let x=0;x<w;x+=17)line(r,g,[x,2,0],[x,2,19],shade(c,.97));
 line(r,g,[0,3,21],[w,3,21],R.accent,2);line(r,g,[side,0,21],[side,h,21],R.accent,2);
 box(r,g,w/2,-1,86,w+12,12,5,shade(c,1.45));
 box(r,g,side,h/2,86,12,h+6,5,shade(c,1.3));
 for(let x of [0,w]){box(r,g,x,0,0,14,14,86,shade(c,1.12));box(r,g,x,0,80,20,20,7,shade(c,1.4));}
 if(!['archive','generator'].includes(R.id)){windowOnBack(r,g,35,59,R);windowOnBack(r,g,205,59,R);}
 else{
  for(let i=0;i<6;i++){let x=20+i*47;line(r,g,[x,3,70],[x,3,83],shade(c,1.1),4);}
 }
 if(R.id==='chamber'){windowOnBack(r,g,108,72,R);}
 // Weathered side panels, salt trails, and a thin top rail.
 for(let i=0;i<24;i++){let y=8+rnd(i,4)*(h-16),z=27+rnd(i,9)*51;line(r,g,[side,y,z],[side,y+1,z-8-rnd(i,5)*14],shade(c,.74));}
 for(let y=20;y<h;y+=41){line(r,g,[side,y,25],[side,y,72],shade(c,1.16),2);}
}
function furniture(r,g,P,state,R){
 const [kind,x,y,w,h]=P,c='#705d43',m='#57686a',gold='#b09a64';
 if(['table','desk','workbench','console'].includes(kind)){
  for(let a of [-1,1])for(let b of [-1,1])box(r,g,x+a*(w/2-5),y+b*(h/2-4),0,4,4,23,kind==='console'?m:'#493f30');
  box(r,g,x,y,21,w,h,4,kind==='workbench'||kind==='console'?'#576561':'#826d4c');
  if(kind==='desk'){box(r,g,x-w/2+11,y,4,20,h-4,18,'#5c4a35');for(let z of [9,15,21]){line(r,g,[x-w/2+2,y+h/2,z],[x-w/2+21,y+h/2,z],'#2f2923');box(r,g,x-w/2+12,y+h/2+1,z,5,2,1,gold);}}
  for(let i=0;i<3;i++){let xx=x-12+i*10,yy=y-1+(i%2)*7;poly(r,g,[[xx-6,yy-5,25.5],[xx+6,yy-5,25.5],[xx+6,yy+4,25.5],[xx-6,yy+4,25.5]],i%2?'#b1aa89':'#d1c7a2');for(let j=0;j<3;j++)line(r,g,[xx-4,yy-3+j*2,25.7],[xx+3,yy-3+j*2,25.7],'#7a806d');}
  if(kind==='desk'||kind==='table'){box(r,g,x+22,y-5,25,9,9,2,'#8e794b');box(r,g,x+22,y-5,27,2,2,11,'#a5915d');disk(r,g,x+22,y-5,39,8,'#b0a078',14);disk(r,g,x+22,y-5,38.5,6,'#efce8c',14);}
  if(kind==='console'){box(r,g,x,y-4,25,w-8,17,11,'#547470');for(let i=0;i<5;i++){box(r,g,x-w/2+15+i*11,y-3,36,6,6,1,i%2?'#8b8f73':'#adc8aa');}for(let i=0;i<3;i++){disk(r,g,x-20+i*20,y+9,27,3,gold,12);} }
 }
 if(kind==='bench'||kind==='cot'){
  for(let a of [-1,1])for(let b of [-1,1])box(r,g,x+a*(w/2-5),y+b*(h/2-4),0,4,4,11,'#383c35');
  box(r,g,x,y,9,w,h,5,kind==='cot'?'#717263':'#736347');
  if(kind==='cot'){box(r,g,x-w/2+13,y,14,19,h-5,4,'#aaa792');box(r,g,x+12,y,14,w/2,h-2,3,'#586f67');for(let i=0;i<3;i++)line(r,g,[x+1+i*9,y-h/2,17],[x+1+i*9,y+h/2,17],'#7c8c7b');}
  else{box(r,g,x,y-h/2,11,w,4,21,'#5b503e');for(let a of [-1,1])box(r,g,x+a*(w/2-2),y,15,4,h,3,'#8f7951');}
 }
 if(kind==='chair'){for(let a of [-1,1])for(let b of [-1,1])box(r,g,x+a*6,y+b*6,0,3,3,14,'#66523b');box(r,g,x,y,13,18,18,3,'#856b49');box(r,g,x,y+8,15,18,3,20,'#554b3a');}
 if(kind==='shelf'){
  box(r,g,x,y,0,w,h,60,'#594c38');box(r,g,x,y+h/2+.3,4,w-7,1,53,'#242c29');
  for(let z of [5,21,38,58])box(r,g,x,y+h/2+1,z,w-3,h,2,'#82704e');
  for(let row=0;row<3;row++)for(let i=0;i<Math.floor(w/5)-2;i++){
   let xx=x-w/2+6+i*5,zz=7+row*17,hh=9+rnd(i,row+x)*6;
   box(r,g,xx,y+h/2-2,zz,3.5,8,hh,['#687365','#79624c','#4a6466','#988561','#6d564a'][Math.floor(rnd(i+4,row+y)*5)]);
   line(r,g,[xx-1,y+h/2+2,zz+2],[xx+1,y+h/2+2,zz+2],'#bdac7c');
  }
 }
 if(kind==='cabinet'){
  box(r,g,x,y,0,w,h,43,'#75644b');box(r,g,x,y+h/2+.5,6,w-7,2,32,'#344548');
  line(r,g,[x,y+h/2+2,6],[x,y+h/2+2,37],'#938666',2);for(let a of [-1,1])box(r,g,x+a*3,y+h/2+2,22,2,2,4,gold);
  if(R.id==='archive'&&state.flags.bells&&!state.flags.core){disk(r,g,x,y,46,7,'#a7e8d9',6);}
 }
 if(kind==='crate'){
  box(r,g,x,y,0,w,h,24,'#71634b');for(let z of [7,18]){line(r,g,[x-w/2,y+h/2,z],[x+w/2,y+h/2,z],'#a08e62',2);}line(r,g,[x-w/2+2,y+h/2,2],[x+w/2-2,y+h/2,22],'#9e895f',3);
 }
 if(kind==='barrel'||kind==='stove'){
  const rad=w/2;box(r,g,x,y,0,w*.9,h*.9,kind==='stove'?29:27,kind==='stove'?'#415354':'#685c46');disk(r,g,x,y,kind==='stove'?29:27,rad,kind==='stove'?'#65756e':'#927e58',18);
  for(let z of [4,22])ring(r,g,x,y,z,rad,'#354641');
  if(kind==='stove'){box(r,g,x+4,y-3,29,8,8,55,'#354748');box(r,g,x,y+h/2,9,12,2,9,'#d69753');}
 }
 if(kind==='plant'){
  box(r,g,x,y,0,15,15,12,'#6b6351');for(let i=0;i<8;i++){let a=i*.8,xx=x+Math.cos(a)*11,yy=y+Math.sin(a)*9;line(r,g,[x,y,10],[xx,yy,26+rnd(i,x)*12],'#889175',2);poly(r,g,[[xx,yy,24],[xx-6,yy-3,31],[xx+2,yy+2,36]],'#4d695e');}
 }
 if(kind==='clock'){
  box(r,g,x,y,0,19,11,60,'#65543b');box(r,g,x,y+6,12,11,2,28,'#273833');const q=r.w(x,y+8,48);px.disc(g,q[0],q[1],11,'#d1c097');px.disc(g,q[0],q[1],9,'#5a6559');px.line(g,q[0],q[1],q[0]+5,q[1]-4,'#d4c7a1');px.line(g,q[0],q[1],q[0]-2,q[1]-6,'#d4c7a1');line(r,g,[x,y+8,37],[x,y+8,20],'#a89a66');disk(r,g,x,y+8,19,4,'#ae9a63');
 }
 if(kind==='statue'){
  box(r,g,x,y,0,w,h,10,'#71817b');box(r,g,x,y,10,w-7,h-7,15,'#506866');box(r,g,x,y,25,11,9,19,'#83928b');disk(r,g,x,y,45,7,'#9baa9c',8);box(r,g,x,y,48,5,5,11,'#9baa9c');box(r,g,x,y,58,10,10,3,'#758c84');
 }
 if(kind==='generator'){
  box(r,g,x,y,0,w+7,h+6,7,'#3b504f');box(r,g,x,y,7,w,h,32,'#556763');
  for(let i=0;i<7;i++)box(r,g,x-w/2+7+i*14,y-8,39,5,h-19,11,'#7b8170');
  box(r,g,x,y+h/2,13,w-13,3,23,'#233b3d');for(let i=0;i<3;i++){const q=r.w(x-30+i*30,y+h/2+3,29);px.disc(g,q[0],q[1],9,'#acaa8a');px.disc(g,q[0],q[1],6,'#334e4e');px.line(g,q[0],q[1],q[0]+(state.flags.power?4:-4),q[1]-3,'#d3c899');}
  for(let i=0;i<4;i++)box(r,g,x-31+i*21,y+h/2+4,19,5,3,2,state.flags.power?'#a0c696':'#a07351');
 }
 if(kind==='pipewall'){for(let i=0;i<3;i++)box(r,g,x+i*7-7,y,0,4,4,80,'#6b8079');for(let z of [15,65])box(r,g,x,y,z,25,6,3,'#8b8f70');}
 if(kind==='bells'){
  box(r,g,x,y,0,w+8,h+4,12,'#665c45');for(let i=0;i<3;i++){let xx=x-17+i*17;box(r,g,xx,y,12,3,3,22,'#807447');disk(r,g,xx,y,28+i*3,7-i,'#b3a06d');box(r,g,xx,y,28+i*3,9-i,9-i,8,'#938356');}line(r,g,[x-26,y,39],[x+26,y,39],'#c1a66c',3);
 }
 if(kind==='orrery'||kind==='telescope'){
  const q=kind==='telescope';box(r,g,x,y,0,q?55:37,q?45:37,7,'#586e68');disk(r,g,x,y,7,q?27:21,'#859578');box(r,g,x,y,8,13,13,q?33:23,'#8c7c53');disk(r,g,x,y,q?41:31,q?18:23,'#b0a276');
  if(!q){
   const center=r.w(x,y,49);for(let i=0;i<3;i++){const pts=[];for(let j=0;j<65;j++){let a=j/64*Math.PI*2;pts.push(r.w(x+Math.cos(a)*24,y+Math.sin(a)*24*Math.cos(i),49+Math.sin(a)*22*Math.sin(i)));}for(let j=1;j<pts.length;j++)px.line(g,pts[j-1][0],pts[j-1][1],pts[j][0],pts[j][1],i===1?'#c0ab70':'#738e80',2);}px.disc(g,center[0],center[1],10,'#b0c1aa');px.disc(g,center[0]-2,center[1]-3,5,'#d7dbc2');
  }else{
   // A faceted, tilted brass lens. Each face has its own tone.
   let A=[x-27,y,52],B=[x+27,y-9,75],polys=[];const n=16;
   for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;let p=[A[0],A[1]+Math.cos(a)*16,A[2]+Math.sin(a)*16],p2=[A[0],A[1]+Math.cos(b)*16,A[2]+Math.sin(b)*16],p3=[B[0],B[1]+Math.cos(b)*21,B[2]+Math.sin(b)*21],p4=[B[0],B[1]+Math.cos(a)*21,B[2]+Math.sin(a)*21];polys.push({p:[p,p2,p3,p4],d:Math.cos(a),c:shade('#ab9360',.55+(Math.sin(a)+1)*.32)});}
   polys.sort((a,b)=>a.d-b.d);for(const p of polys)poly(r,g,p.p,p.c);
   const rim=[],inside=[];for(let i=0;i<32;i++){let a=i/32*Math.PI*2;rim.push([B[0]+.5,B[1]+Math.cos(a)*22,B[2]+Math.sin(a)*22]);inside.push([B[0]+1,B[1]+Math.cos(a)*18,B[2]+Math.sin(a)*18]);}poly(r,g,rim,'#cab282');poly(r,g,inside,state.flags.signal?'#b1efe3':'#477578');
   const inner=inside.map(p=>[p[0]+1,B[1]+(p[1]-B[1])*.65,B[2]+(p[2]-B[2])*.65]);poly(r,g,inner,state.flags.signal?'#e4fff3':'#254c58');
   for(let f of [.1,.25,.78]){let xx=A[0]+(B[0]-A[0])*f,yy=A[1]+(B[1]-A[1])*f,zz=A[2]+(B[2]-A[2])*f,rr=16+5*f;const pts=[];for(let i=0;i<=32;i++){let a=i/32*Math.PI*2;pts.push(r.w(xx,yy+Math.cos(a)*rr,zz+Math.sin(a)*rr));}for(let i=1;i<pts.length;i++)px.line(g,pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],'#bdab7a',2);}
  }
 }
}
function door(r,g,d,state){
 const vertical=d.side==='E'||d.side==='W',x=d.x,y=d.y,locked=d.lock&&!state.flags[d.lock]||d.to==='exit'&&!state.flags.signal;
 const axis=vertical?[0,1]:[1,0],p=(a,z,off=0)=>[x+axis[0]*a+(vertical?off:0),y+axis[1]*a+(!vertical?off:0),z];
 // A dark opening and a raised brass threshold identify every route.
 poly(r,g,[p(-18,0),p(18,0),p(18,61),p(-18,61)],'#0a1b21');
 if(locked){poly(r,g,[p(-15,2,1),p(15,2,1),p(15,57,1),p(-15,57,1)],'#394e4e');for(let z of [13,38])line(r,g,p(-13,z,2),p(13,z,2),'#748278',2);for(let a of [-10,0,10])line(r,g,p(a,2,2),p(a,57,2),'#253939');}
 for(let a of [-19,19]){const pt=p(a,0);box(r,g,pt[0],pt[1],0,vertical?9:5,vertical?5:9,63,'#6d7c72');}
 const t=p(0,59);box(r,g,t[0],t[1],59,vertical?10:43,vertical?43:10,5,'#82907f');
 const b=p(0,0);box(r,g,b[0],b[1],0,vertical?13:38,vertical?38:13,2,locked?'#8c7158':'#98a992');
 const lamp=r.w(x,y,53);px.disc(g,lamp[0],lamp[1],2.5,locked?'#c79969':'#afd7bf');
 if(d.side==='S'||(d.side==='W'&&r.view.yawDeg<0)||(d.side==='E'&&r.view.yawDeg>0)){
  // The near wall is cut away to preserve the view of the character.
 }
}
const cache=new Map();
function background(r,R){const key=R.id+':'+r.ix+':'+r.iy+':'+r.W+':'+r.H;let C=cache.get(key);if(C){r.ctx.drawImage(C,0,0);return;}
 r.sky(['#0d1c22','#17282c','#0a151b']);let g=r.ctx;
 // Large empty space reads as the sea beyond the cutaway building.
 for(let i=0;i<36;i++){let y=140+i*12;px.line(g,0,y,960,y,'#203439',1);}
 rearWalls(r,g,R);floor(r,g,R);
 if(!['archive','generator'].includes(R.id))for(const x of [35,205]){
  px.blend(g,.12,'normal',()=>poly(r,g,[[x,4,1.4],[x+59,4,1.4],[Math.min(298,x+139),157,1.4],[Math.min(298,x+80),157,1.4]],'#accbca'));
  for(let i=1;i<3;i++)line(r,g,[x+i*19,4,1.5],[Math.min(298,x+i*19+80),157,1.5],'#40575b',2);
 }
 // Rear walls must occlude the far edge of the floor, but never the walk area.
 C=document.createElement('canvas');C.width=r.bw;C.height=r.bh;C.getContext('2d').drawImage(r.game.screen.buf,0,0);cache.set(key,C);if(cache.size>18)cache.delete(cache.keys().next().value);
}
function draw(r,R,state,hero,rig,enemies,near,time,settings){
 background(r,R);let g=r.ctx;
 for(const P of R.props){r.shadow(P[1],P[2],Math.max(P[3],P[4])*.47,.3,'#0b161a');r.queue(P[1],P[2],0,ctx=>furniture(r,ctx,P,state,R));}
 for(const d of R.doors){r.queue(d.x,d.y,0,ctx=>{ctx.save();const front=d.side==='S'||(d.side==='W'&&r.view.yawDeg<0)||(d.side==='E'&&r.view.yawDeg>0);if(front&&Math.hypot(hero.x-d.x,hero.y-d.y)<92)ctx.globalAlpha=.4;door(r,ctx,d,state);ctx.restore();ctx._c=null;});}
 for(const o of R.objects){if(state.taken.includes(o.id))continue;const q=r.w(o.x,o.y,o.z||14);r.overlay(ctx=>{
  const pulse=.68+Math.sin(time*2.7+o.x)*.2;ctx.save();ctx.globalAlpha=near&&near.id===o.id?1:pulse*.8;
  px.poly(ctx,[[q[0],q[1]-5],[q[0]+3,q[1]],[q[0],q[1]+5],[q[0]-3,q[1]]],o.kind==='note'?'#b6cac0':'#d1bb8c');ctx.restore();ctx._c=null;
 });}
 for(const e of enemies){if(e.room!==state.room)continue;if(e.hp<=0&&!e.echo){r.queue(e.body.x,e.body.y,0,ctx=>{disk(r,ctx,e.body.x,e.body.y,1,13,'#223638',9);box(r,ctx,e.body.x,e.body.y,1,22,9,3,'#465851');});continue;}
  const b=e.body;r.shadow(b.x,b.y,e.echo?12:8,.6);r.actor(b.x,b.y,e.echo?3+Math.sin(time*2)*2:0,(ctx,ox,oy)=>e.rig.draw(ctx,ox,oy,r.view),{outline:false,alpha:e.echo?.74:1,flash:e.hit>0?'#e0d8b8':false,flashMix:.35});
  r.queue(b.x,b.y,0,ctx=>{const q=r.w(b.x,b.y,e.echo?44:36);px.disc(ctx,q[0],q[1],2,e.wind>0?'#d0a184':'#a3cab9');});
  if(e.wind>0)r.decal(()=>{r.groundRing(b.x,b.y,24,'#c19473',.85);r.groundRing(b.x,b.y,25,'#8e6754',.4);});
 }
 r.shadow(hero.x,hero.y,8,.65);
 r.actor(hero.x,hero.y,hero.z,(ctx,ox,oy)=>rig.draw(ctx,ox,oy,r.view),{outline:false,flash:hero.hurt>.85?'#e9d4b8':false,flashMix:.45});
 // World-space lamp attachment follows the animated left hand.
 const hand=rig.hand('L');r.queue(hero.x,hero.y,0,ctx=>{let q=r.w(...hand);px.rect(ctx,q[0]-3,q[1]-1,6,9,'#b6a074');px.rect(ctx,q[0]-2,q[1]+1,4,5,state.lamp&&state.oil>0?'#ffe2a1':'#455d60');px.line(ctx,q[0]-3,q[1]-2,q[0]+3,q[1]-2,'#c3b18b');},{bias:1});
 if(state.clickTarget){const p=state.clickTarget;r.decal(()=>r.groundRing(p.x,p.y,5,'#b7cab4',.7));}
 r.overlay(ctx=>atmosphere(r,ctx,R,state,hero,time,settings));
}
const mask=document.createElement('canvas');mask.width=962;mask.height=602;const mg=mask.getContext('2d');
function atmosphere(r,g,R,S,H,t,settings){
 mg.clearRect(0,0,962,602);mg.globalCompositeOperation='source-over';mg.fillStyle='rgba(3,13,18,'+Math.max(.05,R.light+(S.flags.signal?.02:0)-(settings.brightness-1)*.32)+')';mg.fillRect(0,0,962,602);
 const lamps=R.lights.map(a=>{const p=r.w(a[0],a[1],a[2]);return [p[0],p[1],a[4],a[3]];});
 if(S.lamp&&S.oil>0){const p=r.w(H.x,H.y,19);lamps.push([p[0],p[1],175,'#efd1a0']);}
 for(const [x,y,rad,c] of lamps){mg.globalCompositeOperation='destination-out';let gr=mg.createRadialGradient(x,y,5,x,y,rad);gr.addColorStop(0,'rgba(0,0,0,.95)');gr.addColorStop(1,'rgba(0,0,0,0)');mg.fillStyle=gr;mg.fillRect(x-rad,y-rad,rad*2,rad*2);}
 g.drawImage(mask,0,0);g.save();g.globalCompositeOperation='screen';
 for(const [x,y,rad,c] of lamps){let gr=g.createRadialGradient(x,y,0,x,y,rad*.6);gr.addColorStop(0,c+'16');gr.addColorStop(1,c+'00');g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);}
 g.restore();g._c=null;
 // Fine drifting salt and dust, with sparse rain at the frame edge.
 for(let i=0;i<40;i++){let x=(rnd(i,201)*960+t*(i%2?2:-2)+960)%960,y=(rnd(i,20)*600+t*(.5+i%3))%600;px.blend(g,.12+rnd(i,7)*.12,'normal',()=>px.dot(g,x,y,'#aec5bb'));}
 if(R.id!=='office'&&R.id!=='archive')for(let i=0;i<18;i++){let x=rnd(i,98)*960,y=(rnd(i,51)*600+t*100)%600;if(x<90||x>890)px.line(g,x,y,x-6,y+17,'#34525d');}
 if(S.flags.signal&&R.id==='chamber'){let a=r.w(186,66,75);g.save();g.globalAlpha=.15;px.poly(g,[[a[0],a[1]-15],[960,0],[960,260],[a[0],a[1]+15]],'#d5fff0');g.restore();g._c=null;}
}
function collision(R){return {groundAt:()=>0,collide(b){let hit=false,rr=b.r||7;
 const oldx=b.x,oldy=b.y;b.x=Math.max(10+rr,Math.min(R.w-10-rr,b.x));b.y=Math.max(9+rr,Math.min(R.h-9-rr,b.y));if(oldx!==b.x||oldy!==b.y)hit=true;
 for(const a of R.solids){const cx=Math.max(a[0],Math.min(a[2],b.x)),cy=Math.max(a[1],Math.min(a[3],b.y)),dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy);
  if(d<rr){hit=true;if(d>.001){b.x=cx+dx/d*rr;b.y=cy+dy/d*rr;}else{const candidates=[[Math.abs(b.x-a[0]),a[0]-rr,b.y],[Math.abs(b.x-a[2]),a[2]+rr,b.y],[Math.abs(b.y-a[1]),b.x,a[1]-rr],[Math.abs(b.y-a[3]),b.x,a[3]+rr]].sort((a,b)=>a[0]-b[0]);b.x=candidates[0][1];b.y=candidates[0][2];}}
 }return hit;}};}
function clearLine(R,a,b,radius=3){const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.ceil(d/5);for(let i=1;i<n;i++){let x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;if(R.solids.some(s=>x>s[0]-radius&&x<s[2]+radius&&y>s[1]-radius&&y<s[3]+radius))return false;}return true;}
function path(R,start,target){const step=10,cols=30,rows=22,blocked=(x,y)=>x<1||x>=29||y<1||y>=21||R.solids.some(s=>x*step+5>s[0]-8&&x*step+5<s[2]+8&&y*step+5>s[1]-8&&y*step+5<s[3]+8);
 const sx=Math.floor(start.x/step),sy=Math.floor(start.y/step);let tx=Math.max(1,Math.min(28,Math.floor(target.x/step))),ty=Math.max(1,Math.min(20,Math.floor(target.y/step)));
 if(blocked(tx,ty)){let best=null;for(let x=tx-4;x<=tx+4;x++)for(let y=ty-4;y<=ty+4;y++)if(!blocked(x,y)){let d=Math.hypot(x-tx,y-ty);if(!best||d<best.d)best={x,y,d};}if(!best)return[];tx=best.x;ty=best.y;}
 const key=(x,y)=>y*cols+x,from=new Map(),q=[[sx,sy]],seen=new Set([key(sx,sy)]);let found=false;
 for(let i=0;i<q.length;i++){let [x,y]=q[i];if(x===tx&&y===ty){found=true;break;}for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){let a=x+dx,b=y+dy,k=key(a,b);if(seen.has(k)||blocked(a,b)||dx&&dy&&(blocked(x+dx,y)||blocked(x,y+dy)))continue;seen.add(k);from.set(k,key(x,y));q.push([a,b]);}}
 if(!found)return[];let rev=[],k=key(tx,ty);while(k!==key(sx,sy)&&rev.length<700){rev.push({x:(k%cols)*step+5,y:Math.floor(k/cols)*step+5});k=from.get(k);if(k===undefined)return[];}return rev.reverse();
}
for(const [id,R] of Object.entries(ROOMS))R.id=id;
window.SignalWorld={ROOMS,draw,collision,path,clearLine,shade};
})();
