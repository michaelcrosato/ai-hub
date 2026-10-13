/* The Freight Yard: original geometry and gameplay data. */
(function(root){'use strict';const E=root.My3D2dge,M=root.BreakwaterMesh,mesh=[],ramps=[],solids=[],rails=[];
const face=(p,c,o)=>M.face(mesh,p,c,o),box=(x,y,z,w,d,h,c)=>M.box(mesh,x,y,z,w,d,h,c),beam=(a,b,w,c)=>M.beam(mesh,a,b,w,c);
const B={x:0,y:0,w:240,h:210};const trench={x:142,y:147,w:12,h:35};
function inside(x,y,r,margin=0){return x>=r.x-margin&&x<=r.x+r.w+margin&&y>=r.y-margin&&y<=r.y+(r.d===undefined?r.h:r.d)+margin;}
function groundRect(x,y,w,d,c,z=0,tile=12){for(let yy=y;yy<y+d-.01;yy+=tile)for(let xx=x;xx<x+w-.01;xx+=tile){const x1=Math.min(x+w,xx+tile),y1=Math.min(y+d,yy+tile),cc=E.shade(c,(E.hash2(xx,yy)-.5)*.045);face([[xx,yy,z],[x1,yy,z],[x1,y1,z],[xx,y1,z]],cc);}}
groundRect(0,0,240,147,'#80918e');groundRect(0,147,142,35,'#87968f');groundRect(154,147,86,35,'#87968f');groundRect(0,182,240,28,'#80918e');
// Pier walls and the open water beyond the yard.
box(-4,-5,-10,248,5,10,'#51686b');box(-5,0,-10,5,210,10,'#4d676a');box(240,0,-10,5,210,10,'#4d676a');box(-4,210,-10,248,5,10,'#51686b');
groundRect(-300,-260,840,250,'#486e78',-9,65);groundRect(-220,-10,210,400,'#426a74',-9,60);groundRect(250,-10,210,400,'#426a74',-9,60);groundRect(-30,216,300,120,'#426a74',-9,50);
for(let i=0;i<80;i++){const x=-160+E.hash2(i,77)*500,y=-200+E.hash2(i,21)*195,w=4+E.hash2(i,87)*16;face([[x,y,-8.9],[x+w,y,-8.9],[x+w,y+.5,-8.9],[x,y+.5,-8.9]],'#709497');}
// Slab joints, paint, and a readable route spine.
for(let x=12;x<239;x+=24)face([[x,0,.014],[x+.12,0,.014],[x+.12,210,.014],[x,210,.014]],'#748580');
for(let y=12;y<210;y+=24){if(y>147&&y<182){face([[0,y,.017],[142,y,.017],[142,y+.12,.017],[0,y+.12,.017]],'#748580');face([[154,y,.017],[240,y,.017],[240,y+.12,.017],[154,y+.12,.017]],'#748580');}else face([[0,y,.017],[240,y,.017],[240,y+.12,.017],[0,y+.12,.017]],'#748580');}
for(let x=18;x<216;x+=9){if(x<138||x>155)face([[x,185,.04],[x+5,185,.04],[x+5,185.35,.04],[x,185.35,.04]],'#d8c783');}
for(const y of[145,183])for(let x=137;x<160;x+=3)face([[x,y,.06],[x+1.3,y,.06],[x+3,y+1.8,.06],[x+1.7,y+1.8,.06]],'#e5b465');
function addRamp(id,x,y,w,d,h,axis,dir,quarter=false){const r={id,x,y,w,d,h,axis,dir,quarter};ramps.push(r);const N=quarter?10:4;function pt(u,s){const xx=axis==='x'?x+w*u:x+w*s,yy=axis==='y'?y+d*u:y+d*s,v=dir===1?u:1-u,zz=h*(quarter?1-Math.cos(v*Math.PI/2):v);return[xx,yy,zz];}
 for(let n=0;n<N;n++){const u=n/N,v=(n+1)/N;for(let s=0;s<3;s++){const c=quarter?'#b6b8a8':'#a7b7a8';face([pt(u,s/3),pt(v,s/3),pt(v,(s+1)/3),pt(u,(s+1)/3)],E.shade(c,n%2?.03:0));}const a=pt(u,0),b=pt(v,0),c=pt(u,1),d2=pt(v,1);face([[a[0],a[1],0],[b[0],b[1],0],b,a],'#637c7a');face([[c[0],c[1],0],[d2[0],d2[1],0],d2,c],'#546f73');}
 const lo=dir===1?1:0;beam(pt(lo,0),pt(lo,1),.35,'#e6d697');
 // Yellow edge marks point toward the launch.
 for(const s of[.05,.93]){const u=dir===1?.16:.84,v=dir===1?.75:.25;const a=pt(u,s),b=pt(v,s);a[2]+=.035;b[2]+=.035;const c=pt(v,s+.018),d2=pt(u,s+.018);c[2]+=.035;d2[2]+=.035;face([a,b,c,d2],'#d8e090');}
 return r;}
function addRail(id,name,a,b,z,color='#d0d7c6'){const r={id,name,a,b,z,len:Math.hypot(b[0]-a[0],b[1]-a[1])};rails.push(r);const n=Math.ceil(r.len/5);for(let i=0;i<n;i++){const u=i/n,v=(i+1)/n;beam([E.lerp(a[0],b[0],u),E.lerp(a[1],b[1],u),z],[E.lerp(a[0],b[0],v),E.lerp(a[1],b[1],v),z],.48,color);}for(let u=.05;u<1;u+=Math.min(.5,10/r.len)){const x=E.lerp(a[0],b[0],u),y=E.lerp(a[1],b[1],u);box(x-.28,y-.28,0,.56,.56,z,'#405e65');box(x-1,y-1,.02,2,2,.18,'#526f72');}return r;}
// First line: launch, long rail, manual, then the gap.
addRamp('dock-kicker',48,154,12,22,3.5,'x',1);addRail('dock','Dock rail',[68,165],[109,165],3.2);
addRamp('gap-kicker',126,154,12,24,5,'x',1);addRamp('return-bank',176,130,13,14,5,'x',-1);
box(142,147,-8,12,35,.3,'#376570');box(140.8,147,-7,1.2,35,7,'#526b6c');box(154,147,-7,1.2,35,7,'#526b6c');
// Tide bowl: open entry and four curved quarterpipes.
groundRect(30,32,65,63,'#738d8b',.02,10);
addRamp('bowl-west',16,31,15,66,9,'x',-1,true);addRamp('bowl-east',94,31,15,66,9,'x',1,true);addRamp('bowl-north',31,16,63,16,9,'y',-1,true);addRamp('bowl-south',31,95,24,15,9,'y',1,true);addRamp('bowl-south-east',77,95,17,15,9,'y',1,true);
addRail('north-coping','North coping',[32,16.7],[93,16.7],9.1,'#ced6c5');
for(let x=40;x<94;x+=8)face([[x,30,.05],[x+3,30,.05],[x+3,31,.05],[x,31,.05]],'#cedab9');
// A pump channel that can be jumped in either direction.
addRamp('pump-kicker',37,130,33,12,4.5,'y',-1);box(33,118,0,44,6,1.2,'#597577');
for(let x=35;x<77;x+=3)box(x,118,1.2,.3,6,.13,'#bdcbbb');
// Cargo island and its approach.
box(132,57,0,47,31,7.9,'#407d81');solids.push({id:'cargo',x:132,y:57,w:47,d:31,h:8});groundRect(132,57,47,31,'#8aafa3',8,8);addRamp('cargo-bank',116,62,16,21,8,'x',1);addRamp('cargo-exit',179,62,16,21,8,'x',-1);
for(let x=134;x<178;x+=3){box(x,56.8,.4,.3,.35,7,'#529196');box(x,87.85,.4,.3,.35,7,'#2c6872');}
addRail('cargo','Cargo spine',[136,72],[175,72],10.1,'#edc989');
addRamp('service-kicker',110,106,12,20,4.5,'x',1);box(123,106,0,7,20,1.1,'#c18c5b');for(let y=107;y<126;y+=2)box(123,y,1.1,7,.6,.2,'#cda978');
addRail('service','Service rail',[156,108],[196,127],3.2);addRail('entry','Entry rail',[30,185],[55,185],2.4);
// Signal bridge and secret service deck.
box(185,22,0,28,31,12,'#53787b');solids.push({id:'secret-deck',x:185,y:22,w:28,d:31,h:12});groundRect(185,22,28,31,'#879e8f',12,7);addRamp('signal-bank',164,34,21,16,12,'x',1);
for(let i=0;i<5;i++)box(188+i*5,21.8,12,.3,.4,4,'#5d7472');beam([185,22,16],[214,22,16],.4,'#d5c795');beam([213,22,16],[213,53,16],.4,'#d5c795');
// Warehouse: repeated metal panels, loading doors, clerestory, roof ribs.
box(207,61,0,38,100,26,'#647d7f');solids.push({id:'warehouse',x:207,y:61,w:38,d:100,h:26});
for(let y=62;y<160;y+=6){box(206.7,y,1,.3,.25,24,'#9ca297');if(y%12===2)box(206.45,y+1,18,.25,4,3,'#4d6974');}
for(let y=76;y<153;y+=31){box(206.5,y,0,.4,21,13,'#354f5e');for(let z=1;z<13;z+=1.6)box(206.3,y,z,.1,21,.08,'#758584');box(205.4,y-1,0,1,23,.5,'#bac1ad');}
for(let y=62;y<161;y+=9)beam([207,y,26],[245,y,26],.4,'#a3aea0');
box(206.3,118,16,.35,27,5,'#d7c59b');
// Decorative containers and crates, with full collision.
for(const s of[{x:8,y:175,w:17,d:25,h:8,c:'#ba745a'},{x:85,y:194,w:48,d:15,h:10,c:'#487c82'},{x:140,y:192,w:32,d:16,h:9,c:'#ad8862'},{x:111,y:10,w:45,d:13,h:11,c:'#be7856'}]){box(s.x,s.y,0,s.w,s.d,s.h,s.c);solids.push(s);for(let x=s.x+1;x<s.x+s.w-1;x+=2.6)box(x,s.y-.18,.4,.26,.22,s.h-.7,E.shade(s.c,-.16));}
for(const s of[{x:194,y:177,w:8,d:8,h:4},{x:194,y:167,w:7,d:7,h:6},{x:9,y:120,w:7,d:7,h:4},{x:97,y:131,w:6,d:6,h:3}]){box(s.x,s.y,0,s.w,s.d,s.h,'#a58a65');solids.push(s);beam([s.x,s.y-.15,.5],[s.x+s.w,s.y-.15,s.h-.4],.24,'#d2b689');}
// Perimeter fence. Posts are small enough not to interrupt the riding line.
for(let x=0;x<241;x+=12){box(x-.18,1.5,0,.36,.36,5,'#526a6c');box(x-.18,208,0,.36,.36,5,'#526a6c');}for(let x=0;x<240;x+=12){beam([x,1.5,4],[x+12,1.5,4],.14,'#a1afa0');beam([x,208,4],[x+12,208,4],.14,'#a1afa0');}
for(let y=4;y<207;y+=12){box(1.5,y,0,.36,.36,5,'#526a6c');beam([1.5,y,4],[1.5,y+12,4],.14,'#a1afa0');}
// Light poles and a large orange harbor crane frame.
for(const [x,y]of[[25,144],[118,29],[193,141],[80,190]]){box(x-.4,y-.4,0,.8,.8,23,'#405d67');beam([x,y,23],[x+5,y,23],.4,'#566e70');box(x+4,y-1,22.5,3,2,.8,'#e7d5a8');}
for(const x of[17,195]){box(x,-21,-4,3,3,65,'#b87859');beam([x,-20,61],[x,-79,68],1.7,'#c3916b');beam([x,-20,50],[x,-68,65],.8,'#ca9c75');beam([x,-70,67],[x,-70,25],.18,'#425c66');beam([x,-19,7],[x+28,-19,52],1.3,'#a37058');}
// Asphalt edge wear and skid marks: world geometry, not decoration in the interface.
for(let i=0;i<85;i++){let x=8+E.hash2(i,71)*195,y=10+E.hash2(i,37)*180;if(inside(x,y,trench))continue;const a=E.hash2(i,16)*6.28,l=1+E.hash2(i,18)*4;face([[x,y,.025],[x+Math.cos(a)*l,y+Math.sin(a)*l,.025],[x+Math.cos(a)*l+.15,y+Math.sin(a)*l+.15,.025],[x+.15,y+.15,.025]],'#627b783f'.slice(0,7));}
const letters=[{id:'B',x:59,y:165,z:6.2},{id:'R',x:156,y:72,z:13},{id:'E',x:67,y:35,z:4},{id:'A',x:184,y:157,z:4},{id:'K',x:56,y:116,z:4.5}];
const beacons=[{id:0,x:38,y:174,z:2.4},{id:1,x:184,y:132,z:2.4},{id:2,x:63,y:59,z:2.4}];
const secret={x:201,y:36,z:15.2};
const gaps=[{id:'saltwater',name:'SALTWATER GAP',axis:'x',lo:141,hi:155,range:[147,182],bonus:1000},{id:'pump',name:'PUMP CHANNEL',axis:'y',lo:116,hi:126,range:[32,79],bonus:700},{id:'service',name:'SERVICE TRANSFER',axis:'x',lo:123,hi:131,range:[104,128],bonus:850}];
function surface(x,y){let h=0,hit=null;if(inside(x,y,trench))return{h:-8,ramp:null};for(const s of solids)if(inside(x,y,s)&&s.h>h){h=s.h;hit=null;}for(const r of ramps)if(inside(x,y,r)){const u=r.axis==='x'?(x-r.x)/r.w:(y-r.y)/r.d,v=r.dir===1?u:1-u,hh=r.h*(r.quarter?1-Math.cos(E.clamp(v,0,1)*Math.PI/2):v);if(hh>=h-.05){h=hh;hit=r;}}return{h,ramp:hit};}
function zone(x,y){if(x>177&&y<60)return'SIGNAL DECK';if(x<112&&y<111)return'TIDE BOWL';if(x>112&&y<100)return'CARGO LINE';if(y>142)return'DOCKSIDE';return'SERVICE YARD';}
root.BreakwaterLevel={mesh,ramps,solids,rails,letters,beacons,secret,gaps,bounds:B,trench,inside,surface,zone,spawn:{x:31,y:165,dir:0},gate:{x:184,y:32,w:2,d:20,h:16}};
})(window);
