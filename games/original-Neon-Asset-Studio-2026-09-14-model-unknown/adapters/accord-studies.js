/** New low-polygon Accord coupe studies. These are not recovered game geometry.
 * +X = forward. +Y = right. +Z = up. World-unit scale matches the source car length.
 * Proportions use the ninth-generation coupe (2013-2017 model years, introduced in 2012).
 */
const PAINT=[.91,.92,.89,1],SHADE=[.69,.73,.72,1],GLASS=[.085,.18,.215,1],GLASS2=[.12,.25,.29,1],INK=[.035,.045,.05,1],TIRE=[.055,.064,.072,1],CHROME=[.62,.7,.73,1],LAMP=[.82,.89,.9,1],RED=[.78,.075,.055,1],AMBER=[.97,.46,.07,1];
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function area2(poly){return poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0);}
/** Ear clipping for simple concave outlines. Used for real wheel arch cutouts. */
function triangulate2D(poly){
 const ids=poly.map((_,i)=>i),out=[];if(area2(poly)<0)ids.reverse();
 const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const inside=(p,a,b,c)=>turn(a,b,p)>=-1e-10&&turn(b,c,p)>=-1e-10&&turn(c,a,p)>=-1e-10;
 let count=0;
 while(ids.length>3){let found=false;for(let i=0;i<ids.length;i++){
  const a=ids[(i+ids.length-1)%ids.length],b=ids[i],c=ids[(i+1)%ids.length];
  if(turn(poly[a],poly[b],poly[c])<1e-10)continue;
  if(ids.some(j=>j!==a&&j!==b&&j!==c&&inside(poly[j],poly[a],poly[b],poly[c])))continue;
  out.push([a,b,c]);ids.splice(i,1);found=true;break;
 }if(!found||++count>1000)throw Error('Cannot triangulate body outline.');}
 out.push(ids);return out;
}
function interp(rows,x,index){
 for(let i=1;i<rows.length;i++)if(x<=rows[i][0]){const a=rows[i-1],b=rows[i],t=Math.max(0,(x-a[0])/(b[0]-a[0]));return a[index]*(1-t)+b[index]*t;}
 return rows.at(-1)[index];
}
function accordStudy(code='B'){
 if(!['A','B','C','D'].includes(code))throw Error('Use study A, B, C, or D.');
 const tier=code==='A'?0:code==='C'?2:1,facelift=code==='D';
 const labels={A:'A · Accord coupe / Minimum',B:'B · Accord coupe / Balanced',C:'C · Accord coupe / Character',D:'D · Accord coupe / 2016-17'};
 const parts=[],cache=new Map();let serial=0;
 function mesh(name,color=PAINT,group=name,pivot=[0,0,0],role='body'){
  const key=group+'|'+name+'|'+color.join(',');if(cache.has(key))return cache.get(key);
  const p={id:'study-'+code+'-'+String(++serial).padStart(3,'0'),name,group,kind:'mesh',position:[...pivot],rotation:[0,0,0],scale:[1,1,1],vertices:[],faces:[],color:[...color],material:'MAT_VEHICLE',visible:true,locked:false,pivot:[...pivot],role};parts.push(p);cache.set(key,p);return p;
 }
 function poly(part,vertices,normal,indices=null){
  let fs=indices|| (vertices.length<=4?[vertices.map((_,i)=>i)]:triangulate2D(vertices.map(v=>[v[0],v[2]])));
  const start=part.vertices.length;
  for(const v of vertices)part.vertices.push(v.map((n,i)=>+(n-part.position[i]).toFixed(7)));
  for(let f of fs){const n=cross(sub(vertices[f[1]],vertices[f[0]]),sub(vertices[f[2]],vertices[f[0]]));if(Math.hypot(...n)<1e-10)throw Error('Zero area: '+part.name);if(normal&&dot(n,normal)<0)f=[...f].reverse();part.faces.push(f.map(i=>i+start));}
 }
 function strip(part,a,b,c,d,normal){poly(part,[a,b,c,d],normal);}
 function flat(name,vs,color,normal,group=name){const p=mesh(name,color,group);
  if(group==='Front fascia'&&vs.length===4&&vs[0][1]<0&&vs[1][1]>0&&vs[2][1]>0&&vs[3][1]<0){
   const mid=(a,b)=>{const t=-a[1]/(b[1]-a[1]),offset=(a[0]-(2.44-.30*(Math.abs(a[1])/.86)**2)+b[0]-(2.44-.30*(Math.abs(b[1])/.86)**2))/2;return [2.44+offset,0,a[2]*(1-t)+b[2]*t];};
   const top=mid(vs[0],vs[1]),bottom=mid(vs[3],vs[2]);poly(p,[vs[0],top,bottom,vs[3]],normal);poly(p,[top,vs[1],vs[2],bottom],normal);
  }else poly(p,vs,normal);return p;}
 const outline=tier===0?[[-2.42,.75,.915],[-1.48,.932,1.005],[.7,.925,.97],[2.10,.865,.885],[2.42,.735,.80]]:[[-2.42,.75,.915],[-2.19,.875,.99],[-1.38,.932,1.015],[-.25,.93,.995],[1.1,.923,.955],[2.10,.865,.885],[2.42,.735,.80]];
 const width=x=>interp(outline,x,1),waist=x=>interp(outline,x,2),shoulder=x=>waist(x)-.105;
 const sideY=(x,z)=>width(x)*(1-.055*Math.max(0,(shoulder(x)-z)/.7));
 const archSegments=tier===0?3:tier===1?4:6;
 const bottom=[[-2.42,.235]];
 for(const axle of[-1.38,1.365]){
  bottom.push([axle-.435,.19]);
  for(let i=0;i<=archSegments;i++){const a=Math.PI-i*Math.PI/archSegments;bottom.push([axle+.385*Math.cos(a),.342+.385*Math.sin(a)]);}
  bottom.push([axle+.435,.19]);
 }
 bottom.push([2.42,.235]);
 const sideOutline=[...bottom,...[...outline].reverse().map(r=>[r[0],r[2]-.105])];
 const sideFaces=triangulate2D(sideOutline);
 for(const s of[-1,1]){
  const group=s<0?'Left body':'Right body',panel=mesh(group+' / wheel arch panel',PAINT,group);
  poly(panel,sideOutline.map(([x,z])=>[x,s*sideY(x,z),z]),[0,s,0],sideFaces);
  const band=mesh(group+' / shoulder',PAINT,group);
  for(let i=1;i<outline.length;i++){
   const a=outline[i-1],b=outline[i];strip(band,[a[0],s*a[1],a[2]-.105],[b[0],s*b[1],b[2]-.105],[b[0],s*b[1]*.94,b[2]],[a[0],s*a[1]*.94,a[2]],[0,s,.5]);
  }
  if(tier>0){
   // The sill is one visible sheet, not a stack of hidden cuboids.
   const xs=[-.92,.89],vs=xs.map(x=>[x,s*(sideY(x,.24)+.003),.24]);
   flat(group+' / sill crease',[vs[0],vs[1],[.89,s*(sideY(.89,.19)+.004),.19],[-.92,s*(sideY(-.92,.19)+.004),.19]],SHADE,[0,s,0],group);
  }
  if(tier===2){
   const arch=mesh(group+' / arch inner edge',SHADE,group);
   for(const axle of[-1.38,1.365])for(let i=0;i<archSegments;i++){
    const a=Math.PI-i*Math.PI/archSegments,b=Math.PI-(i+1)*Math.PI/archSegments;
    const x1=axle+.385*Math.cos(a),z1=.342+.385*Math.sin(a),x2=axle+.385*Math.cos(b),z2=.342+.385*Math.sin(b),y1=s*sideY(x1,z1),y2=s*sideY(x2,z2);
    strip(arch,[x1,y1,z1],[x2,y2,z2],[x2,y2-s*.055,z2],[x1,y1-s*.055,z1],[0,0,-1]);
   }
  }
 }
 const deck=mesh('Hood and rear deck',PAINT,'Body');
 for(let i=1;i<outline.length;i++){const a=outline[i-1],b=outline[i];for(const [u,v] of (b[0]>1.9?[[-1,0],[0,1]]:[[-1,1]]))strip(deck,[a[0],a[1]*.94*u,a[2]],[b[0],b[1]*.94*u,b[2]],[b[0],b[1]*.94*v,b[2]],[a[0],a[1]*.94*v,a[2]],[0,0,1]);}
 // Compact front and rear bumper sheets close the visible body ends.
 for(const end of[-1,1]){
  const x=end*2.42,w=width(x),z=waist(x);for(const [u,v] of (end>0?[[-1,0],[0,1]]:[[-1,1]]))flat(end>0?'Front bumper':'Rear bumper',[[x,w*.945*u,.235],[x,w*.945*v,.235],[x,w*v,z-.105],[x,w*u,z-.105]],PAINT,[end,0,0],'Body');
  for(const [u,v] of (end>0?[[-1,0],[0,1]]:[[-1,1]]))flat(end>0?'Front shoulder edge':'Rear shoulder edge',[[x,w*u,z-.105],[x,w*v,z-.105],[x,w*.94*v,z],[x,w*.94*u,z]],PAINT,[end,0,0],'Body');
 }
 flat('Underbody',[[-2.25,-.52,.18],[2.25,-.52,.18],[2.25,.52,.18],[-2.25,.52,.18]],INK,[0,0,-1],'Body');
 // Sweep the front corners behind the grille. Split front sheets retain the center point.
 for(const p of parts)for(const v of p.vertices)if(v[0]>1.9)v[0]-=.30*Math.pow(Math.abs(v[1])/.86,2)*Math.min(1,(v[0]-1.9)/.52);
 // Side roof profile. The long roof arc and small rear quarter window carry the identity.
 const roof=[[-.77,.655,1.367],[-.25,.635,1.413],[.40,.65,1.35]];
 const sideGlassY=z=>.825-(z-.975)*.405;
 const sidePoint=(s,x,z,offset=0)=>[x,s*(sideGlassY(z)+offset),z];
 for(const s of[-1,1]){
  const group=s<0?'Left cabin':'Right cabin';
  const outer=[[1.055,.955],[.4,1.35],[-.25,1.413],[-.77,1.367],[-1.62,1.014]];
  const p=mesh(group+' / pillars',PAINT,group);poly(p,outer.map(([x,z])=>sidePoint(s,x,z)),[0,s,0],triangulate2D(outer));
  const front=[[.925,.986],[.345,1.324],[-.25,1.384],[-.595,1.351],[-.59,1.017]];
  const quarter=[[-.66,1.022],[-.66,1.344],[-.775,1.335],[-1.378,1.046]];
  poly(mesh(group+' / long door glass',GLASS,group),front.map(([x,z])=>sidePoint(s,x,z,.004)),[0,s,0],triangulate2D(front));
  poly(mesh(group+' / rear quarter glass',GLASS,group),quarter.map(([x,z])=>sidePoint(s,x,z,.004)),[0,s,0]);
  flat(group+' / black B pillar',[sidePoint(s,-.656,1.019,.003),sidePoint(s,-.589,1.017,.003),sidePoint(s,-.596,1.355,.003),sidePoint(s,-.658,1.349,.003)],INK,[0,s,0],group);
  if(tier>0){
   const trim=mesh(group+' / window edge',CHROME,group);
   const line=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ox=-dz/len*.009,oz=dx/len*.009;strip(trim,sidePoint(s,a[0],a[1],.005),sidePoint(s,b[0],b[1],.005),sidePoint(s,b[0]+ox,b[1]+oz,.005),sidePoint(s,a[0]+ox,a[1]+oz,.005),[0,s,0]);};
   const rim=[[.925,.986],[.345,1.324],[-.25,1.384],[-.775,1.335],[-1.378,1.046],[-.59,1.017],[.925,.986]];
   for(let i=1;i<rim.length;i++)line(rim[i-1],rim[i]);
   // One rear door seam and one handle on each side. No four-door cues.
   const bodyGroup=s<0?'Left body':'Right body',seam=mesh(bodyGroup+' / long door seam',SHADE,bodyGroup);
   const path=[[-.615,.855],[-.61,.49],[-.53,.265],[.64,.265],[.84,.34],[.91,.84]];
   for(let i=1;i<path.length;i++){const [x1,z1]=path[i-1],[x2,z2]=path[i],len=Math.hypot(x2-x1,z2-z1),dx=-(z2-z1)/len*.008,dz=(x2-x1)/len*.008;strip(seam,[x1,s*(sideY(x1,z1)+.003),z1],[x2,s*(sideY(x2,z2)+.003),z2],[x2+dx,s*(sideY(x2+dx,z2+dz)+.003),z2+dz],[x1+dx,s*(sideY(x1+dx,z1+dz)+.003),z1+dz],[0,s,0]);}
   flat(bodyGroup+' / single handle',[[-.54,s*(width(-.54)+.006),.901],[-.32,s*(width(-.32)+.006),.901],[-.32,s*(width(-.32)+.006),.923],[-.54,s*(width(-.54)+.006),.923]],CHROME,[0,s,0],bodyGroup);
  }
 }
 // Windshield and rear window: single surfaces, with painted side pillars in the cabin mesh.
 flat('Windshield',[[1.055,-sideGlassY(.955),.955],[1.055,sideGlassY(.955),.955],[.4,sideGlassY(1.35),1.35],[.4,-sideGlassY(1.35),1.35]],GLASS2,[1,0,1],'Glass');
 flat('Rear window',[[-1.62,-sideGlassY(1.014),1.014],[-1.62,sideGlassY(1.014),1.014],[-.77,sideGlassY(1.367),1.367],[-.77,-sideGlassY(1.367),1.367]],GLASS,[-1,0,1],'Glass');
 const roofPart=mesh('Low curved roof',PAINT,'Roof');
 const crossRows=tier===0?[-1,1]:[-1,0,1];
 for(let i=1;i<roof.length;i++)for(let j=1;j<crossRows.length;j++){
  const a=roof[i-1],b=roof[i],pointAt=(row,t)=>[row[0],t*sideGlassY(row[2]),row[2]+(1-t*t)*(tier>0?.022:0)];
  strip(roofPart,pointAt(a,crossRows[j-1]),pointAt(b,crossRows[j-1]),pointAt(b,crossRows[j]),pointAt(a,crossRows[j]),[0,0,1]);
 }
 // Swept headlights and the inset grille. These sheets do not need invisible back faces.
 const frontX=y=>2.44-.30*Math.pow(Math.abs(y)/.86,2);
 const frontP=(y,z,offset=0)=>[frontX(y)+offset,y,z];
 const lightP=(y,z,offset=0)=>[2.44-.49*Math.pow(Math.abs(y)/.86,2)+offset,y,z];
 for(const s of[-1,1]){
  const pts=facelift?[[s*.38,.812],[s*.82,.79],[s*.86,.886],[s*.43,.881]]:[[s*.39,.764],[s*.81,.81],[s*.861,.905],[s*.46,.866]];
  flat((s<0?'Left':'Right')+' swept headlight',pts.map(([y,z])=>lightP(y,z,.017)),LAMP,[1,0,.2],'Front lights');
  if(tier>0){
   flat((s<0?'Left':'Right')+' amber tip',[lightP(s*.775,.817,.020),lightP(s*.828,.839,.020),lightP(s*.858,.901,.020),lightP(s*.800,.88,.020)],AMBER,[1,0,.2],'Front lights');
   const fog=facelift?[[s*.57,.36],[s*.80,.40],[s*.80,.55],[s*.55,.55]]:[[s*.56,.39],[s*.75,.38],[s*.80,.61],[s*.57,.59]];
   flat((s<0?'Left':'Right')+' bumper intake',fog.map(([y,z])=>frontP(y,z,.018)),INK,[1,0,0],'Front fascia');
   if(facelift)flat((s<0?'Left':'Right')+' LED bar',[[s*.58,.435],[s*.755,.435],[s*.755,.461],[s*.58,.461]].map(([y,z])=>frontP(y,z,.022)),LAMP,[1,0,0],'Front fascia');
  }
 }
 flat('Upper grille',[frontP(-.48,.855,.02),frontP(.48,.855,.02),frontP(.355,.67,.02),frontP(-.355,.67,.02)],INK,[1,0,0],'Front fascia');
 flat('Lower grille',[frontP(-.53,.60,.02),frontP(.53,.60,.02),frontP(.64,.335,.02),frontP(-.64,.335,.02)],INK,[1,0,0],'Front fascia');
 if(tier>0){
  const chrome=mesh(facelift?'Wide chrome grille wing':'Thin grille surround',CHROME,'Front fascia');
  if(facelift){
   for(const [u,v] of[[-1,0],[0,1]])strip(chrome,frontP(.48*u,.863,.025),frontP(.48*v,.863,.025),frontP(.31*v,.772,.027),frontP(.31*u,.772,.027),[1,0,0]);
  }else for(const s of[-1,1])strip(chrome,frontP(s*.48,.855,.023),frontP(s*.355,.67,.023),frontP(s*.33,.681,.024),frontP(s*.45,.852,.024),[1,0,0]);
 }
 // Rear: wide red lights with an angled side return, not generic rectangular blocks.
 for(const s of[-1,1]){
  flat((s<0?'Left':'Right')+' rear lamp',[[ -2.434,s*.30,.88],[-2.434,s*.715,.87],[-2.434,s*.71,.704],[-2.434,s*.36,.748]],RED,[-1,0,0],'Rear lights');
  flat((s<0?'Left':'Right')+' rear lamp return',[[-2.425,s*.754,.87],[-2.02,s*(width(-2.02)+.002),.952],[-2.17,s*(width(-2.17)+.002),.79],[-2.425,s*.754,.704]],RED,[0,s,0],'Rear lights');
  if(tier>0){
   flat((s<0?'Left':'Right')+' reverse strip',[[-2.438,s*.335,.822],[-2.438,s*.49,.822],[-2.438,s*.49,.851],[-2.438,s*.335,.851]],LAMP,[-1,0,0],'Rear lights');
  }
 }
 if(tier>0){
  flat('Rear plate recess',[[-2.435,-.255,.55],[-2.435,.255,.55],[-2.435,.255,.73],[-2.435,-.255,.73]],INK,[-1,0,0],'Rear fascia');
  flat('Rear plate',[[-2.441,-.18,.586],[-2.441,.18,.586],[-2.441,.18,.69],[-2.441,-.18,.69]],CHROME,[-1,0,0],'Rear fascia');
 }
 // Faceted mirrors, connected at the front corner of each long door.
 for(const s of[-1,1]){
  const p=mesh((s<0?'Left':'Right')+' mirror',PAINT,'Mirrors');
  const vs=[[.85,s*.823,1.02],[.77,s*1.01,1.024],[.57,s*.99,1.02],[.60,s*.842,1.02],[.77,s*.975,1.13],[.61,s*.965,1.12]];
  poly(p,vs,[0,s,.5],[[0,1,4],[0,4,5,3],[3,5,2],[2,5,4,1],[0,3,2,1]]);
  if(tier===2)flat((s<0?'Left':'Right')+' mirror glass',[[.569,s*.99,1.03],[.608,s*.965,1.11],[.764,s*.975,1.12],[.767,s*1.01,1.034]],CHROME,[-1,0,0],'Mirrors');
 }
 // Wheels remain independent parts with real axle centers for later animation.
 const n=tier===0?6:tier===1?8:10,radius=.334;
 for(const axle of[-1.38,1.365])for(const s of[-1,1]){
  const group=(axle>0?'Front':'Rear')+(s<0?' left wheel':' right wheel'),pivot=[axle,s*.814,.342],role=axle>0?'steer-wheel':'wheel';
  const tire=mesh(group+' / tire',TIRE,group,pivot,role);
  const ring=(y,r)=>Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/n;return [axle+r*Math.cos(a),y,.342+r*Math.sin(a)];});
  const outer=ring(s*.927,radius),inner=ring(s*.703,radius);
  for(let i=0;i<n;i++)poly(tire,[inner[i],inner[(i+1)%n],outer[(i+1)%n],outer[i]],[Math.cos(-Math.PI/2+(i+.5)*2*Math.PI/n),0,Math.sin(-Math.PI/2+(i+.5)*2*Math.PI/n)]);
  const fan=Array.from({length:n-2},(_,i)=>[0,i+1,i+2]);
  poly(tire,inner,[0,-s,0],fan);poly(tire,outer,[0,s,0],fan);
  const rim=mesh(group+' / alloy',CHROME,group,pivot,role),rimVertices=ring(s*.9285,tier===0?.216:.236);
  if(tier<2)poly(rim,rimVertices,[0,s,0],fan);
  else{
   const rimIn=ring(s*.930,.188);
   for(let i=0;i<n;i++)poly(rim,[rimVertices[i],rimVertices[(i+1)%n],rimIn[(i+1)%n],rimIn[i]],[0,s,0]);
   for(let i=0;i<5;i++){
    const a=i*2*Math.PI/5,b=a+.23,rs=(r,t)=>[axle+r*Math.cos(t),s*.932,.342+r*Math.sin(t)];
    poly(rim,[rs(.065,a-.22),rs(.205,a-.055),rs(.205,b+.09),rs(.065,b)],[0,s,0]);
   }
   const hub=ring(s*.933,.065);poly(rim,hub,[0,s,0],fan);
  }
 }
 if(tier===2){
  // Small surfaces add specific cues. No texture maps are required.
  for(const s of[-1,1]){
   flat('Hood crease '+s,[[1.105,s*.42,waist(1.105)+.003],[2.1,s*.51,waist(2.1)+.003],[2.1,s*.524,waist(2.1)+.003],[1.105,s*.435,waist(1.105)+.003]],SHADE,[0,0,1],'Body');
   flat('Exhaust '+s,[[-2.446,s*.52,.24],[-2.446,s*.69,.24],[-2.446,s*.69,.33],[-2.446,s*.52,.33]],CHROME,[-1,0,0],'Rear fascia');
  }
  flat('Subtle trunk lip',[[-2.28,-.77,1.005],[-2.28,.77,1.005],[-2.15,.81,1.012],[-2.15,-.81,1.012]],PAINT,[0,0,1],'Body');
  const badge=mesh('Small H badge',CHROME,'Front fascia');
  for(const y of[-.035,.026])strip(badge,frontP(y,.721,.032),frontP(y+.009,.721,.032),frontP(y+.009,.793,.032),frontP(y,.793,.032),[1,0,0]);
  strip(badge,frontP(-.035,.752,.033),frontP(.035,.752,.033),frontP(.035,.764,.033),frontP(-.035,.764,.033),[1,0,0]);
 }
 // Weld identical vertices within each named part; preserve the authored triangle count.
 for(const p of parts){const vs=[],map=new Map();p.faces=p.faces.map(f=>f.map(index=>{const v=p.vertices[index],key=v.join(',');if(!map.has(key)){map.set(key,vs.length);vs.push(v);}return map.get(key);}));p.vertices=vs;}
 const triangleCount=parts.reduce((s,p)=>s+p.faces.reduce((n,f)=>n+f.length-2,0),0);
 const doc={schema:'neon.asset/1',id:'accord-study-'+code.toLowerCase(),name:labels[code],category:'Vehicles',revision:0,units:'world-unit',upAxis:'Z',parts,colliders:[],source:null,style:{name:'Accord coupe / Neon Fare study',palette:[PAINT,SHADE,GLASS,INK,CHROME,LAMP,RED,AMBER],shading:'flat',maxTriangles:triangleCount},notes:[
 'New authored study, not an original repo model. '+(facelift?'2016-2017 facelift cues.':'2013-2015 pre-facelift cues.'),
 '2012 refers to the ninth-generation launch year, not the North American 2012 model-year coupe. The latter is an earlier body style.',
 'Main cues: long two-door cabin, low curved roof, small angled rear quarter windows, high rear shoulder, swept headlights and a short rear deck.',
 'Length is 4.84 world units before small lamp overlays. Target proportions use 189.2 inch length, 72.8 inch width, 56.5 inch height and 107.3 inch wheelbase. Mirrors extend beyond the body width.',
 'Static, opaque, flat-color exterior mesh. Hidden interior and some inward body surfaces are omitted to save triangles. This is not a watertight collision mesh.',
 'The wheel groups use local coordinates and retain separate axle-center pivots. Reconnect the game steering, road pose and body transforms during integration.',
 'No collision shapes or animation clips are supplied. Native triangle counts include all four wheels and all visible details.',
 'Shape recognition is a design judgment, not a measured recognition test.'],history:[],references:[],study:{code,tier,facelift,modelYears:facelift?'2016-2017':'2013-2015',triangleCount,bodyLength:4.84,wheelbase:2.745,bodyWidth:1.864,targetHeight:1.435,referenceRepository:'michaelcrosato/neon-fare-arcade-2',referenceCommit:'7838dee3fad90d743ed559097cda88d7c6d070a4'}};
 return doc;
}
function accordStudies(){return ['A','B','C','D'].map(accordStudy);}

export { accordStudy, accordStudies };
