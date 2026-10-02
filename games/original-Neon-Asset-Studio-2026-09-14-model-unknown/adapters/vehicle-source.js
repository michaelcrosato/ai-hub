/** Reviewed geometry translation. Source functions and numbers are kept below.
 * Source: michaelcrosato/neon-fare-arcade-2 @ 7838dee3fad90d743ed559097cda88d7c6d070a4.
 * No game code is fetched or run by this module. All models use a zero steering rest pose.
 */
const COMMIT='7838dee3fad90d743ed559097cda88d7c6d070a4';
const INK=[.035,.045,.055,1],RUBBER=[.07,.075,.08,1],GLASS=[.075,.23,.29,1],CHROME=[.67,.74,.76,1],WHITE=[.94,.95,.9,1],RED=[.94,.085,.045,1],LAMP=[1,.94,.69,1];
const point=(x,y,z)=>({x,y,z});
let section='Body';
const face=(corners,color)=>({corners,color,material:'MAT_VEHICLE',kind:'architecture',section});
function box(out,x,y,z,sx,sy,sz,color,yaw=0){
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const p=[-1,1].flatMap(zs=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([xs,ys])=>point(x+c*xs*sx/2-s*ys*sy/2,y+s*xs*sx/2+c*ys*sy/2,z+zs*sz/2)));
 for(const indices of [[3,2,1,0],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])out.push(face(indices.map(i=>p[i]),color));
}
function wheelModel(){
 const out=[],segments=20;
 const ring=(y,radius,angle)=>point(Math.sin(angle)*radius,y,Math.cos(angle)*radius);
 const profile=[[-.18,.32],[-.15,.42],[-.09,.46],[.09,.46],[.15,.42],[.18,.32]];
 for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
  for(let j=1;j<profile.length;j++){
   const [y0,r0]=profile[j-1],[y1,r1]=profile[j];
   out.push(face([ring(y0,r0,a),ring(y0,r0,b),ring(y1,r1,b),ring(y1,r1,a)],j===3&&i%2?INK:RUBBER));
  }
  for(const side of [-1,1]){
   const y=side*.181;
   out.push(face([ring(y,.32,a),ring(y,.32,b),ring(y,.27,b),ring(y,.27,a)],CHROME));
   out.push(face([point(0,y*.99,0),ring(y*.99,.27,a),ring(y*.99,.27,b)],INK));
   if(i%4<2)out.push(face([ring(y*1.02,.08,a),ring(y*1.02,.27,a+.06),ring(y*1.02,.27,b-.04),ring(y*1.02,.08,b)],CHROME));
  }
 }
 box(out,0,0,0,.13,.38,.13,CHROME);return out;
}
/** Port of buildModel. Face coordinates, color values, and winding are unchanged. */
function reviewedDetailedModel(id){
 if(!['crown-cab','accord-v6'].includes(id))throw Error('Unknown vehicle ID.');
 const coupe=id==='accord-v6',body=[];
 const paint=coupe?WHITE:[1,.78,.015,1],shade=coupe?[.72,.77,.77,1]:[.86,.5,.018,1];
 const length=coupe?4.96:5.5,halfWidth=coupe?1.01:1.12,axles=coupe?[-1.46,1.43]:[-1.62,1.53];
 const rear=coupe?-1.48:-1.55,front=coupe?1.12:1.17,roofRear=coupe?-.73:-1.03,roofFront=coupe?.38:.68;
 const roofHeight=coupe?1.89:2.03,roofWidth=halfWidth*.78,waist=1.19;
 const widthAt=x=>halfWidth*(1-.16*Math.pow(Math.abs(x)/(length/2),4));
 const archAt=x=>Math.max(.36,...axles.map(axle=>Math.abs(x-axle)<=.54?.49+Math.sqrt(Math.max(0,.54**2-(x-axle)**2)):.36));
 const sections=[-length/2,-length/2+.16,0,length/2-.18,length/2,...axles.flatMap(axle=>Array.from({length:13},(_,i)=>axle-.54+i*.09))].sort((a,b)=>a-b);
 section='Body shell';
 for(let i=1;i<sections.length;i++){
  const a=sections[i-1],b=sections[i],wa=widthAt(a),wb=widthAt(b);
  for(const side of [-1,1]){
   const surface=[point(a,side*wa,archAt(a)),point(b,side*wb,archAt(b)),point(b,side*wb,1.08),point(a,side*wa,1.08)];
   body.push(face(side>0?[surface[3],surface[2],surface[1],surface[0]]:surface,paint));
   body.push(face([point(a,side*wa,1.08),point(b,side*wb,1.08),point(b,side*wb*.93,waist),point(a,side*wa*.93,waist)],paint));
  }
  body.push(face([point(a,-wa*.93,waist),point(b,-wb*.93,waist),point(b,wb*.93,waist),point(a,wa*.93,waist)],paint));
 }
 section='Underbody';box(body,0,0,.38,length-.4,halfWidth*1.15,.2,INK);
 for(const end of [-1,1]){
  section=end>0?'Front fascia':'Rear fascia';
  const x=end*length/2,w=widthAt(x);
  body.push(face([point(x,-w,.36),point(x,w,.36),point(x,w,1.08),point(x,-w,1.08)],paint));
  body.push(face([point(x,-w,1.08),point(x,w,1.08),point(x,w*.93,waist),point(x,-w*.93,waist)],paint));
  box(body,x+end*.01,0,.49,.06,w*1.94,.07,INK);
  box(body,x+end*.02,0,.76,.05,coupe?1.02:1.18,.27,INK);
  box(body,x+end*.052,0,.76,.015,.39,.14,WHITE);
  if(end>0){
   for(let slat=0;slat<4;slat++)box(body,x+.04,0,.87+slat*.055,.04,coupe?.85:1.25,.018,CHROME);
   if(coupe){box(body,x+.07,-.055,.956,.025,.015,.10,CHROME);box(body,x+.07,.055,.956,.025,.015,.10,CHROME);box(body,x+.07,0,.956,.025,.12,.015,CHROME);}
  }
  for(const side of [-1,1]){
   const inner=side*w*.6,outer=side*w*.95;
   body.push(face([point(x+end*.034,inner,.94),point(x+end*.034,outer,.86),point(x+end*.034,outer,1.08),point(x+end*.034,inner,1.07)],end>0?LAMP:RED));
   box(body,x-end*.17,side*(w+.005),.99,.34,.024,.14,end<0?RED:[1,.52,.04,1]);
   if(end<0)box(body,x-.035,side*.67,.36,.20,.19,.11,CHROME);
  }
 }
 const sideWindow=(side,x,z)=>{const blend=(z-waist)/(roofHeight-waist);return point(x,side*(halfWidth*.925*(1-blend)+roofWidth*blend),z);};
 for(const side of [-1,1]){
  section=side<0?'Left glass and pillars':'Right glass and pillars';
  body.push(face([sideWindow(side,rear,waist+.006),sideWindow(side,front,waist+.006),sideWindow(side,roofFront,roofHeight),sideWindow(side,roofRear,roofHeight)],GLASS));
  const pillar=(lowX,highX,thickness,color)=>{
   const corners=[sideWindow(side,lowX-thickness,waist),sideWindow(side,lowX,waist),sideWindow(side,highX,roofHeight),sideWindow(side,highX-thickness,roofHeight)];
   body.push(face(corners.map(p=>({...p,y:p.y+side*.012})),color));
  };
  pillar(front,roofFront,.065,paint);pillar(rear+(coupe?.24:.15),roofRear+.09,coupe?.24:.15,paint);pillar(coupe?-.60:-.12,coupe?-.48:-.11,.055,INK);
  box(body,(front+rear)/2,side*halfWidth*.93,waist,front-rear,.045,.035,CHROME);
  section=side<0?'Left doors and mirrors':'Right doors and mirrors';
  const doorRear=coupe?-.66:-.21;
  for(const edge of(coupe?[doorRear,.94]:[-1.23,doorRear,.94]))box(body,edge,side*(widthAt(edge)+.006),.77,.014,.012,.55,shade);
  for(const handle of(coupe?[-.46]:[-1.04,.06]))box(body,handle,side*(widthAt(handle)+.014),1.018,.2,.055,.028,CHROME);
  box(body,.87,side*1.03,1.24,.11,.28,.065,INK);box(body,.86,side*1.14,1.32,.24,.22,.13,paint);box(body,.733,side*1.14,1.33,.009,.18,.08,CHROME);
  box(body,-.1,side*halfWidth,.38,1.54,.06,.10,shade);
  if(!coupe)for(let tile=0;tile<12;tile++)box(body,-1.25+tile*.2,side*(widthAt(-1.25+tile*.2)+.014),.91+tile%2*.07,.19,.018,.065,INK);
 }
 for(const [lowX,highX,isFront]of[[front,roofFront,true],[rear,roofRear,false]]){
  section=isFront?'Windshield':'Rear glass';
  body.push(face([point(lowX,-halfWidth*.925,waist),point(lowX,halfWidth*.925,waist),point(highX,roofWidth,roofHeight),point(highX,-roofWidth,roofHeight)],GLASS));
  const mid=lowX*.82+highX*.18,h=waist*.82+roofHeight*.18,w=halfWidth*.925*.82+roofWidth*.18;
  body.push(face([point(mid,-w*.88,h+.009),point(mid,w*.88,h+.009),point(mid+(isFront?-.05:.05),w*.88,h+.04),point(mid+(isFront?-.05:.05),-w*.88,h+.04)],[.24,.48,.52,1]));
 }
 section='Roof';const roofSections=[-1,-.75,0,.75,1];
 for(let i=1;i<roofSections.length;i++){
  const a=roofSections[i-1],b=roofSections[i],z=t=>roofHeight+(1-t*t)*.065;
  body.push(face([point(roofRear,roofWidth*a,z(a)),point(roofFront,roofWidth*a,z(a)),point(roofFront,roofWidth*b,z(b)),point(roofRear,roofWidth*b,z(b))],paint));
 }
 section='Hood and trunk';
 for(const side of[-1,1])body.push(face([point(front+.05,side*.61,waist+.008),point(length/2-.22,side*.49,waist+.008),point(length/2-.22,side*.51,waist+.008),point(front+.05,side*.65,waist+.008)],shade));
 box(body,-length/2+.28,0,1.21,.14,halfWidth*1.70,.055,paint);
 section='Roof equipment';
 if(!coupe){
  box(body,-.08,0,roofHeight+.10,.58,.9,.065,INK);box(body,-.08,0,roofHeight+.23,.46,.78,.21,LAMP);
  const letters=['111010010010010','010101111101101','101101010101101','111010010010111'];
  for(const side of[-1,1])for(let letter=0;letter<4;letter++)for(let pixel=0;pixel<15;pixel++){
   if(letters[letter][pixel]!=='1')continue;
   const y=-side*(-.28+letter*.145+pixel%3*.035),z=roofHeight+.29-Math.floor(pixel/3)*.027,x=-.08+side*.232;
   body.push(face([point(x,y,z),point(x,y-side*.028,z),point(x,y-side*.028,z-.023),point(x,y,z-.023)],INK));
  }
 }else box(body,-.62,0,roofHeight+.075,.17,.07,.075,INK);
 section='Wheel';return {body,wheel:wheelModel(),axles,track:halfWidth-.04};
}
function blank(id,name,path,fn,parameters){return {schema:'neon.asset/1',id,name,category:'Vehicles',revision:0,units:'world-unit',upAxis:'Z',parts:[],colliders:[],source:{repository:'michaelcrosato/neon-fare-arcade-2',commit:COMMIT,path,function:fn,parameters,mode:'curated-source-sample'},style:{name:'Neon Fare',palette:[WHITE,INK,GLASS,CHROME,RED,LAMP],shading:'flat',maxTriangles:4096},notes:[],history:[],references:[]};}
function reviewedDetailedAsset(id){
 const model=reviewedDetailedModel(id),doc=blank('neon-'+id+'-detailed',id==='accord-v6'?'Accord coupe · Detailed (repo)':'Crown Cab · Detailed (repo)','game/render/detailed-vehicles.ts','detailedVehicleModel',{vehicleId:id,graphics:'detailed',heading:0,steering:0,bodyRoll:0,bodyPitch:0});
 const append=(faces,label,pivot=[0,0,0],role='body')=>{
  const groups=new Map();
  faces.forEach((f,index)=>{const key=(label||f.section)+'|'+f.color.join(',');if(!groups.has(key))groups.set(key,{group:label||f.section,color:f.color,vertices:[],faces:[],sourceFaceIndices:[]});const g=groups.get(key),start=g.vertices.length;g.vertices.push(...f.corners.map(p=>[p.x,p.y,p.z]));g.faces.push(f.corners.map((_,i)=>start+i));g.sourceFaceIndices.push(index);});
  for(const g of groups.values())doc.parts.push({id:'p'+String(doc.parts.length+1).padStart(3,'0'),name:g.group+' / '+(JSON.stringify(g.color)===JSON.stringify(CHROME)?'Chrome':JSON.stringify(g.color)===JSON.stringify(GLASS)?'Glass':'Surface '+(doc.parts.length+1)),group:g.group,kind:'mesh',position:pivot,rotation:[0,0,0],scale:[1,1,1],vertices:g.vertices,faces:g.faces,color:[...g.color],material:'MAT_VEHICLE',visible:true,locked:false,pivot:[...pivot],role,sourceExtra:{sourceFaceIndices:g.sourceFaceIndices}});
 };
 append(model.body);
 for(const axle of model.axles)for(const side of[-1,1])append(model.wheel,(axle>0?'Front':'Rear')+(side<0?' left wheel':' right wheel'),[axle,side*model.track,.49],axle>0?'steer-wheel':'wheel');
 doc.notes=['Reviewed translation of the repo detailed mesh. Original coordinates, colors, and face winding are retained. Faces are grouped for editing.','Wheel centers and roles are retained. Zero steering and flat-road rest pose only. No animation, shader, or collision changes are included.'];
 return doc;
}
function crownSimulationAsset(){
 const doc=blank('neon-crown-cab-classic-simulation','Crown Cab · Classic simulation (repo)','game/render/scene.ts','addCrownTaxiBoxes',{vehicleId:'crown-cab',graphics:'classic',drivingModel:'simulation',heading:0,steeringAngle:0,bodyRoll:0,bodyPitch:0});
 const Y=[1,.72,0,1],I=[.035,.035,.035,1],S=[.27,.38,.42,1],B=[.08,.42,.64,1],W=[1,.98,.9,1],R=[.94,.12,.07,1];
 const add=(group,x,y,z,sx,sy,sz,color,tilt=0,role='body')=>doc.parts.push({id:'p'+String(doc.parts.length+1).padStart(3,'0'),name:group+' / '+(doc.parts.length+1),group,kind:'box',position:[x,y,z],rotation:[0,tilt,0],scale:[1,1,1],size:[sx,sy,sz],color,material:'MAT_VEHICLE',visible:true,locked:false,pivot:[x,y,z],role,sourceIndex:doc.parts.length});
 add('Body',0,0,.62,5.38,1.98,.72,Y);add('Hood',1.55,0,1.02,1.72,1.88,.2,Y);add('Trunk',-1.78,0,1.04,1.25,1.9,.22,Y);add('Cabin',-.15,0,1.43,2.72,1.78,.72,Y);add('Roof',-.28,0,1.84,1.72,1.67,.16,Y);
 add('Windshield',.76,0,1.55,.11,1.62,.58,S,-.34);add('Rear glass',-1.02,0,1.54,.11,1.62,.58,S,.3);
 for(const side of[-.9,.9]){add('Side glass',.2,side,1.5,1.62,.08,.5,B);add('B pillar',-.33,side,1.5,.1,.12,.68,I);add('Front door handle',.52,side,.97,.12,.09,.12,I);add('Rear door handle',-1,side,.97,.12,.09,.12,I);}
 add('Front bumper',2.7,0,.57,.16,2.04,.18,S);add('Rear bumper',-2.7,0,.58,.16,2.04,.18,S);add('Grille',2.71,0,.82,.12,.74,.22,I);
 for(const side of[-.66,.66]){add('Headlight',2.72,side,.84,.14,.5,.24,W);add('Tail light',-2.72,side,.85,.14,.46,.25,R);}
 for(const f of[-1.63,1.58])for(const r of[-1,1]){const label=(f>0?'Front':'Rear')+(r<0?' left wheel':' right wheel'),role=f>0?'steer-wheel':'wheel';add(label,f,r*.98,.49,.8,.24,.76,I,0,role);add(label,f,r*.98,.49,.43,.27,.43,S,0,role);}
 add('Taxi sign',-.27,0,2.08,.92,.48,.27,Y);add('Taxi sign',-.16,0,2.1,.52,.5,.09,W);
 for(const side of[-.91,.91])for(const f of[-1.02,-.62,-.22,.18,.58])add('Checkered stripe',f,side,.92,.21,.07,.18,Math.round((f+1.1)*5)%2?I:W);
 doc.notes=['Classic Crown geometry changes with driving mode. This is the simulation-mode rest shape. The arcade classic shape is a separate catalog asset.','Ground shadow excluded. Keep original steering, road pose and roll logic in the game.'];return doc;
}

export { reviewedDetailedModel, reviewedDetailedAsset, crownSimulationAsset };
