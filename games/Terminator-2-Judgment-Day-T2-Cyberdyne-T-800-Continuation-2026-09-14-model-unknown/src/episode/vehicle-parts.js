/** Pure component definitions. All dimensions are game units, not vehicle specifications. */
export const VEHICLE_TYPES = Object.freeze({
  patrol: {label:'PATROL CRUISER',width:2.22,length:5.18,roof:1.77,base:.45,armor:1,wheels:4},
  interceptor: {label:'INTERCEPTOR',width:2.2,length:5.15,roof:1.69,base:.42,armor:1.15,wheels:4},
  suv: {label:'POLICE SUV',width:2.55,length:5.6,roof:2.37,base:.64,armor:1.4,wheels:4},
  van: {label:'TACTICAL VAN',width:2.68,length:6.5,roof:2.9,base:.64,armor:1.65,wheels:4},
  armored: {label:'ARMORED RESPONSE',width:2.95,length:7.2,roof:2.95,base:.7,armor:2.25,wheels:6}
});
const PART_HP={panel:42,frame:78,door:63,glass:14,tire:25,wheel:46,rim:33,lamp:10,grille:13,engine:100,radiator:42,interior:27,trim:15,armor:110};
export function vehiclePartSpecs(type='patrol'){
  const v=VEHICLE_TYPES[type];if(!v)throw new Error('Unknown vehicle type.');
  const out=[],W=v.width/2,L=v.length/2,Y=v.base,top=v.roof,tall=top>2.2;
  const cabinFront=-L*.46,cabinBack=L*.55,glassBottom=Y+.72,glassTop=top-.1;
  const white=type==='armored'?'#465964':type==='van'?'#354c5a':'#c4ced1',black='#16242f',silver='#899da8';
  function add(id,label,kind,pos,size,color=white,extra={}){
    const hp=Math.round((PART_HP[kind]??40)*(kind==='glass'||kind==='lamp'||kind==='tire'?1:v.armor));
    out.push({id,label,kind,pos,size,color,hp,shape:'box',parent:null,rot:[0,0,0],...extra});return out[out.length-1];
  }
  add('floor','CABIN FLOOR','frame',[0,Y,0],[W*1.9,.14,L*1.85],black);
  add('front-frame','FRONT FRAME','frame',[0,Y,-L*.72],[W*1.65,.15,L*.48],black);
  add('rear-frame','REAR FRAME','frame',[0,Y,L*.76],[W*1.65,.15,L*.35],black);
  add('engine','ENGINE','engine',[0,Y+.28,-L*.7],[W*1.08,.5,L*.42],'#46535a');
  add('radiator','RADIATOR','radiator',[0,Y+.38,-L+.23],[W*1.35,.49,.13],'#5a6c75');
  add('battery','ELECTRICAL UNIT','interior',[-W*.69,Y+.42,-L*.57],[.26,.3,.33],'#252b30');
  add('hood','HOOD','panel',[0,Y+.61,-L*.74],[W*1.93,.09,L*.49],black);
  add('trunk','REAR DECK','panel',[0,Y+.59,L*.8],[W*1.92,.09,L*.36],black);
  add('roof','ROOF','panel',[0,top,0.1],[W*1.72,.12,(cabinBack-cabinFront)*.88],white);
  add('dash','DASHBOARD','interior',[0,Y+.71,cabinFront+.23],[W*1.56,.23,.34],'#1d2b34');
  add('steering','STEERING WHEEL','trim',[-W*.43,Y+.85,cabinFront+.47],[.33,.07,.33],'#28333a',{shape:'ring',rot:[.9,0,0]});
  for(const s of [-1,1]){
    const side=s<0?'l':'r',word=s<0?'LEFT':'RIGHT';
    add(`sill-${side}`,`${word} SILL`,'frame',[s*W*.91,Y+.14,0],[.13,.2,L*1.68],white);
    for(const [end,z] of [['f',-L*.69],['r',L*.71]]){
      add(`fender-${side}${end}`,`${word} ${end==='f'?'FRONT':'REAR'} FENDER`,'panel',[s*W*.97,Y+.38,z],[.09,.3,L*.53],white);
    }
    for(const [i,z] of [cabinFront,0.05,cabinBack].entries())add(`pillar-${side}-${i}`,`${word} ${'ABC'[i]} PILLAR`,'frame',[s*W*.86,(glassBottom+top)/2,z],[.085,top-glassBottom+.14,.085],white);
    const frontLength=Math.abs(cabinFront)-.1,rearLength=cabinBack-.13;
    for(const [end,hinge,len] of [['f',cabinFront,frontLength],['r',.09,rearLength]]){
      const id=`door-${side}${end}`,offset=len/2,doorY=Y+.45;
      add(id,`${word} ${end==='f'?'FRONT':'REAR'} DOOR`,'door',[s*W*.95,doorY,hinge],[.09,.58,len],white,{offset:[0,0,offset],side:s,open:end==='f'?s*1.05:0});
      const mid=(glassBottom+glassTop)/2-doorY;
      add(`window-${side}${end}`,`${word} ${end==='f'?'FRONT':'REAR'} WINDOW`,'glass',[0,mid,offset],[.028,Math.max(.28,glassTop-glassBottom-.08),len-.11],'#507b8e',{parent:id});
      add(`window-frame-${side}${end}`,`${word} WINDOW FRAME`,'trim',[0,glassTop-doorY+.035,offset],[.055,.055,len],silver,{parent:id});
      add(`handle-${side}${end}`,`${word} DOOR HANDLE`,'trim',[s*.072,.19,len-.15],[.06,.055,.19],silver,{parent:id});
      add(`trim-${side}${end}`,`${word} DOOR TRIM`,'trim',[s*.06,-.12,offset],[.025,.045,len*.91],silver,{parent:id});
      if(end==='f')add(`mirror-${side}`,`${word} MIRROR`,'trim',[s*.17,.37,.14],[.29,.17,.24],black,{parent:id});
    }
    const qz=cabinBack-.14;
    add(`quarter-${side}`,`${word} QUARTER WINDOW`,'glass',[s*W*.87,(glassBottom+glassTop)/2,qz],[.027,Math.max(.24,glassTop-glassBottom-.1),.16],'#527e90');
    for(const [i,z] of [cabinFront+.7,cabinBack-.45].entries()){
      add(`seat-${side}-${i}`,`${word} SEAT ${i+1}`,'interior',[s*W*.42,Y+.42,z],[W*.64,.25,.54],'#23343e');
      add(`seatback-${side}-${i}`,`${word} SEAT BACK ${i+1}`,'interior',[s*W*.42,Y+.77,z+.2],[W*.64,.68,.15],'#23343e');
    }
  }
  const gy=(glassBottom+glassTop)/2,gh=glassTop-glassBottom;
  if(type==='armored')for(const s of [-1,1])add(`windshield-${s<0?'l':'r'}`,'ARMORED WINDSHIELD','glass',[s*W*.43,gy,cabinFront-.01],[W*.8,gh,.055],'#557582',{hp:52});
  else add('windshield','WINDSHIELD','glass',[0,gy,cabinFront-.01],[W*1.65,gh,.035],'#527e90',{hp:27});
  add('rear-window','REAR WINDOW','glass',[0,gy,cabinBack+.03],[W*1.65,gh,.035],'#527e90',{hp:22});
  add('bumper-front','FRONT BUMPER','panel',[0,Y-.02,-L-.05],[W*2.04,.2,.19],silver);
  add('bumper-rear','REAR BUMPER','panel',[0,Y+.02,L+.07],[W*2.04,.2,.17],silver);
  add('grille-frame','GRILLE FRAME','trim',[0,Y+.41,-L-.015],[W*1.12,.39,.055],'#2b3c49');
  for(let i=0;i<9;i++)add(`grille-${i}`,`GRILLE SLAT ${i+1}`,'grille',[(i-4)*W*.114,Y+.42,-L-.054],[.025,.3,.025],silver);
  for(const s of [-1,1]){
    for(let i=0;i<2;i++)add(`headlight-${s}-${i}`,`${s<0?'LEFT':'RIGHT'} HEADLIGHT ${i+1}`,'lamp',[s*(W*.66+i*.21),Y+.43,-L-.04],[.18,.21,.055],'#eee5b4',{emissive:1.5});
    add(`indicator-${s}`,'FRONT TURN SIGNAL','lamp',[s*W*.88,Y+.2,-L-.06],[.19,.1,.04],'#eab367',{emissive:.3});
    add(`taillight-${s}`,`${s<0?'LEFT':'RIGHT'} TAIL LIGHT`,'lamp',[s*W*.72,Y+.45,L+.015],[.38,.2,.045],'#cb394b',{emissive:.9});
  }
  add('plate-front','FRONT LICENSE PLATE','trim',[0,Y-.02,-L-.16],[.49,.18,.02],'#c2c9bf');
  add('plate-rear','REAR LICENSE PLATE','trim',[0,Y+.03,L+.165],[.49,.18,.02],'#c2c9bf');
  add('lightbar','LIGHT BAR MOUNT','trim',[0,top+.15,.08],[W*1.5,.1,.36],black,{hp:48});
  for(let i=0;i<8;i++)add(`beacon-${i}`,`${i<4?'RED':'BLUE'} ROOF LIGHT ${i%4+1}`,'lamp',[(i-3.5)*W*.185,.15,0],[W*.17,.22,.33],i<4?'#ff354b':'#399cff',{parent:'lightbar',emissive:2.2,beacon:i<4?'red':'blue'});
  const axles=v.wheels===6?[-L*.69,L*.27,L*.72]:[-L*.65,L*.65],radius=tall?.54:.44;
  for(const [a,z] of axles.entries()){
    add(`axle-${a}`,`AXLE ${a+1}`,'frame',[0,radius,z],[W*1.82,.12,.12],'#526774');
    for(const s of [-1,1]){
      const key=`${s<0?'l':'r'}${a}`,id=`wheel-${key}`;
      add(id,`${s<0?'LEFT':'RIGHT'} WHEEL ${a+1}`,'wheel',[s*W*.98,radius,z],[.22,.22,.22],'#4b6070',{shape:'cylinder',rot:[0,0,Math.PI/2],side:s,axle:a});
      add(`tire-${key}`,`${s<0?'LEFT':'RIGHT'} TIRE ${a+1}`,'tire',[0,0,0],[radius*2,.25,radius*2],'#121a22',{parent:id,shape:'tire',radius,side:s});
      add(`rim-${key}`,`${s<0?'LEFT':'RIGHT'} RIM ${a+1}`,'rim',[0,-s*.04,0],[radius*1.18,.29,radius*1.18],silver,{shape:'cylinder',parent:id});
    }
  }
  add('exhaust','EXHAUST','trim',[-W*.53,Y-.23,L*.76],[.1,.1,.95],'#76818b');
  if(type!=='patrol'){
    for(const s of [-1,1])add(`push-${s}`,'PUSH BAR UPRIGHT','armor',[s*.65,Y+.28,-L-.25],[.085,.82,.09],'#4b606d');
    add('push-cross','PUSH BAR CROSSMEMBER','armor',[0,Y+.45,-L-.29],[1.55,.09,.09],'#4b606d');
  }
  if(tall){
    for(const s of [-1,1])add(`running-${s}`,'RUNNING BOARD','panel',[s*(W+.08),Y-.12,.2],[.23,.1,L*1.12],black);
  }
  if(type==='armored')for(const s of [-1,1])for(let i=0;i<3;i++)add(`armor-${s}-${i}`,`SIDE ARMOR ${i+1}`,'armor',[s*(W+.02),Y+.73,(i-1)*.89],[.13,.59,.82],'#526873');
  return out;
}
export function partState(spec){return {hp:spec.hp,max:spec.hp,hits:0,stage:'intact',detached:false};}
export function damagePart(state,damage,kind){
  if(!Number.isFinite(damage)||damage<0)throw new Error('Invalid component damage.');
  if(state.hp<=0)return {changed:false,broken:false};
  state.hits++;state.hp=Math.max(0,state.hp-damage);
  state.stage=state.hp===0?'broken':kind==='tire'?'flat':kind==='glass'?'cracked':state.hp/state.max<=.4?'critical':'damaged';
  return {changed:true,broken:state.hp===0,stage:state.stage};
}
export function driveState(parts){
  const values=parts instanceof Map?[...parts.values()]:parts;
  const entry=id=>values.find(p=>(p.spec?.id??p.id)===id);
  const state=p=>p?.state??p;
  const engine=state(entry('engine')),tires=values.filter(p=>(p.spec?.kind??p.kind)==='tire');
  const flat=tires.filter(p=>state(p).hp<state(p).max).length;
  const lost=values.filter(p=>(p.spec?.kind??p.kind)==='wheel'&&(state(p).hp<=0||state(p).detached)).length;
  return {flat,lost,engineFailed:engine?.hp===0,immobile:engine?.hp===0||lost>=2||flat>=Math.min(3,tires.length),speed:Math.max(.18,1-flat*.16-lost*.28)};
}
export function cleanPartSave(raw,specs){
  if(!Array.isArray(raw))return [];
  const seen=new Set(),out=[];
  for(const row of raw.slice(0,specs.length)){
    if(!Array.isArray(row)||!Number.isInteger(row[0])||row[0]<0||row[0]>=specs.length||seen.has(row[0])||!Number.isFinite(row[1]))continue;
    seen.add(row[0]);out.push([row[0],Math.max(0,Math.min(1,row[1])),row[2]===1?1:0]);
  }
  return out;
}
