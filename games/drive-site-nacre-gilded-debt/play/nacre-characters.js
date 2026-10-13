/* Original Nacre character appearance pass. No downloaded visual assets.
 * Load after my-3d2dge.js and before nacre-game.js.
 * Integration: NacreRig._queueCharacterParts(ctx) calls E.NacreCharacters.queue(this, ctx).
 * Humanoid._drawHD calls that method immediately before sorting its ops.
 * All costume vertices are in the current joint frame, then use the engine's S projection.
 */
(function (E) {
  'use strict';
  const { px, shade } = E;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const mix = (a, b, t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  const norm = (a, fallback=[0, 0, 1]) => { const d=Math.hypot(...a); return d>1e-6?mul(a,1/d):fallback.slice(); };
  const hash = text => { let h=2166136261; for(const c of String(text||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0; };
  const skin = ['#C48C69','#D5A37E','#AC7458','#E0BA94','#8F5D48','#BE967B'];
  const citizens = [
    {name:'dock-worker', size:1.01, shoulderHalf:3.9, torsoW:3.45, hipZ:13.3, legUpper:6.9, legLower:6.8, torso:9.2, limbW:2.2, hair:'short', sleeves:'short', garment:'apron', cloth:'#71867C', trim:'#C0AD84'},
    {name:'market-clerk', size:.97, shoulderHalf:3.05, torsoW:2.6, hipZ:14.5, legUpper:7.5, legLower:7.4, torso:10.0, limbW:1.75, hair:'short', sleeves:'long', garment:'coat', cloth:'#817784', trim:'#C8B59B'},
    {name:'elder-neighbor', size:.94, shoulderHalf:3.2, torsoW:3.0, hipZ:13.5, legUpper:7.0, legLower:7.0, torso:9.1, limbW:1.85, hair:'bald', sleeves:'long', garment:'shawl', cloth:'#998A71', trim:'#D1C5A3', hunch:.16, lean:.035, beard:true},
    {name:'weaver', size:.99, shoulderHalf:3.2, torsoW:2.9, hipZ:13.7, legUpper:7.1, legLower:7.0, torso:9.6, limbW:1.8, hair:'short', sleeves:'short', garment:'robe', cloth:'#A27668', trim:'#CFB596', headwrap:true},
    {name:'port-trader', size:1.07, shoulderHalf:3.65, torsoW:3.45, hipZ:14.4, legUpper:7.4, legLower:7.4, torso:9.6, limbW:2.1, hair:'short', sleeves:'long', garment:'coat', cloth:'#627780', trim:'#BAA276', cap:true},
    {name:'salt-carrier', size:.91, shoulderHalf:3.4, torsoW:2.9, hipZ:13.2, legUpper:6.8, legLower:6.8, torso:9.2, limbW:1.9, hair:'short', sleeves:'none', garment:'tunic', cloth:'#AC9471', trim:'#DBCBAC', headwrap:true},
    {name:'older-artisan', size:1.00, shoulderHalf:3.55, torsoW:3.2, hipZ:13.8, legUpper:7.1, legLower:7.0, torso:9.3, limbW:2.0, hair:'short', sleeves:'short', garment:'apron', cloth:'#857E69', trim:'#B7AB85', beard:true},
    {name:'visitor', size:1.02, shoulderHalf:2.95, torsoW:2.7, hipZ:14.5, legUpper:7.5, legLower:7.4, torso:10.0, limbW:1.7, hair:'short', sleeves:'long', garment:'shawl', cloth:'#7E8D8C', trim:'#CDBCA1', headwrap:true}
  ];

  function options(role, id, color) {
    const seed=hash(id||role), variant=seed%citizens.length;
    const common={build:'heroic', style:'hd', size:1, outfit:'shirt', sleeves:'long',
      cape:null, hood:false, hat:null, courier:false, weapon:null, hair:'short',
      headR:3.05, neck:1.3, hipHalf:1.9, footSpread:2.0,
      nacreRole:role, nacreId:String(id||role), nacreSeed:seed, nacreProfile:variant,
      colors:{skin:skin[(seed>>>5)%skin.length], hair:'#40362E', eye:'#1F2528',
        cloth:color||'#7E8D85', pants:'#4C5652', boot:'#453B31', belt:'#6F503A',
        glove:'#5B4938', metal:'#AAB5B1', metalDk:'#657F82', hilt:'#C8A264', trim:'#B6A17C'}};
    let extra={};
    if(role==='player') extra={size:1.07, shoulderHalf:3.25, torsoW:2.8, hipZ:14.8,
      legUpper:7.6,legLower:7.6,torso:10.0,armUpper:5.6,armLower:5.5,limbW:1.85,
      headR:2.95,neck:1.2,hair:'bald',weapon:'sword',bladeLen:6,
      nacreGarment:'split', colors:{skin:'#C89270',hair:'#203349',cloth:'#29445F',
        pants:'#253847',boot:'#302D2B',belt:'#70513A',glove:'#433B32',
        trim:'#A98B58',cape:'#20344D',capeIn:'#41566A',scarf:'#D7B978',brass:'#E0C28A'}};
    else if(role==='guard'){
      const rank=/sentinel|east-watch/.test(id||'')?2:/door/.test(id||'')?1:0;
      const roof=/roof-watch/.test(id||'');
      extra={size:rank===2?1.055:1.015,shoulderHalf:3.7+(seed%3)*.15,torsoW:3.25,
        hipZ:14.0,legUpper:7.25,legLower:7.2,torso:9.5,limbW:2.1,armor:true,
        hair:'bald',weapon:'sword',bladeLen:10,nacreGarment:'tunic',nacreRank:rank,nacreRoofWatch:roof,
        colors:{cloth:roof?'#435D65':['#4E6665','#526C68','#5D6C68'][seed%3],pants:'#46514D',
          plate:roof?'#86AAA2':rank===2?'#ABB4AA':'#8D9E99',metal:'#B7BFBA',belt:'#806448',
          boot:'#3D3C35',glove:'#665944',trim:'#BBA171',brass:'#CEB06F'}};
    } else if(role==='courier') extra={size:.99,shoulderHalf:3.05,torsoW:2.7,
      hipZ:14.2,legUpper:7.3,legLower:7.2,torso:9.7,limbW:1.75,sleeves:'short',
      nacreGarment:'tunic',colors:{cloth:'#BA8B43',pants:'#706449',boot:'#544231',
        belt:'#775036',hair:'#4F3929',trim:'#D7BC80',brass:'#F0D495'}};
    else if(role==='target') extra={size:1.10,shoulderHalf:3.65,torsoW:3.35,
      hipZ:14.7,legUpper:7.6,legLower:7.5,torso:10.1,limbW:1.95,
      hair:'short',weapon:'sword',bladeLen:9,nacreGarment:'coat',nacreBeard:true,
      colors:{skin:'#D3B092',hair:'#B5AD98',cloth:'#794451',pants:'#41343C',
        boot:'#382F32',belt:'#95733F',glove:'#80604E',trim:'#C7AA6D',
        coat:'#562F3E',scarf:'#A86853',brass:'#E5C78C'}};
    else {
      const c=citizens[variant]; extra={...c,nacreGarment:c.garment,nacreBeard:!!c.beard,
        nacreHeadwrap:!!c.headwrap,nacreCap:!!c.cap,
        colors:{cloth:c.cloth,trim:c.trim,hair:c.beard?(variant===2?'#BEBBA8':'#A5A495'):['#4A352A','#665344','#362F2A','#8B7254'][seed%4],
          pants:['#5F6155','#685B54','#556763','#797563'][seed%4],boot:'#524737',
          glove:skin[(seed>>>5)%skin.length]}};
    }
    const result={...common,...extra,colors:{...common.colors,...extra.colors}};
    // Profile labels are custom metadata; never pass an unsupported outfit or hat to Humanoid.
    delete result.name;delete result.garment;delete result.cloth;delete result.trim;
    delete result.cap;delete result.headwrap;delete result.beard;
    return result;
  }

  function axes(right, up) {
    const z=norm(up), x=norm(cross(right,z),[1,0,0]), y=norm(cross(z,x),[0,1,0]);
    return [x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]];
  }
  function frame(rig, part='body') {
    const J=rig.J,T=rig.mocapTilt;
    if((part==='body'||part==='head')&&T&&T[part]&&T[part].length===9)return T[part];
    const right=sub(J.shR,J.shL), up=sub(J.shC,J.hipC);
    if(part==='head') return axes(right,sub(J.head,J.shC));
    if(part==='hips') return axes(sub(J.hipR,J.hipL),up);
    if(part==='handL'||part==='handR'){
      const side=part.slice(-1);return axes(right,sub(J['elbow'+side],J['hand'+side]));
    }
    if(part==='legL'||part==='legR'){
      const side=part.slice(-1);return axes(sub(J.hipR,J.hipL),sub(J['knee'+side],J['foot'+side]));
    }
    return axes(right,up);
  }
  function offset(anchor, matrix, f=0, r=0, z=0) {
    return [anchor[0]+matrix[0]*f+matrix[1]*r+matrix[2]*z,
      anchor[1]+matrix[3]*f+matrix[4]*r+matrix[5]*z,
      anchor[2]+matrix[6]*f+matrix[7]*r+matrix[8]*z];
  }
  function attachmentPoint(rig, joint, f=0, r=0, z=0, part='body') {
    const a=typeof joint==='string'?rig.J[joint]:joint;
    return offset(a,frame(rig,part),f,r,z);
  }

  function weaponVisible(rig) {
    const s=rig.nacreState||{};
    const alert=s.alert===true||['chase','pursuit','combat'].includes(s.alert);
    return !!(alert||s.parry||s.dodge||s.takedown||s.attack||
      (rig.atkW||0)>.08||(rig.rdW||0)>.15||(rig.poseW?.block||0)>.1);
  }
  function draw(rig,g,ox,oy,view) {
    const weapon=rig.o.weapon;
    rig._nacreSheathed=!!weapon&&!weaponVisible(rig);
    if(rig._nacreSheathed)rig.o.weapon=null;
    try { E.Humanoid.prototype.draw.call(rig,g,ox,oy,view); }
    finally { rig.o.weapon=weapon; }
  }

  function queue(rig, ctx) {
    if(!rig.o.nacreRole)return;
    const {g,S,ops,u}=ctx,J=rig.J,o=rig.o,C=rig.C,role=o.nacreRole;
    const frames={};
    const P=(joint,f=0,r=0,z=0,part='body')=>offset(typeof joint==='string'?J[joint]:joint,
      frames[part]||(frames[part]=frame(rig,part)),f,r,z);
    const projected=p=>S(p[0],p[1],p[2]);
    const polygon=(points,color,bias=.012)=>{
      const q=points.map(projected); const d=q.reduce((v,p)=>v+p[2],0)/q.length+bias;
      ops.push({d,f:()=>px.poly(g,q,color)});
    };
    const line=(a,b,color,width=.65,bias=.02)=>{
      const A=projected(a),B=projected(b);ops.push({d:(A[2]+B[2])*.5+bias,
        f:()=>px.line(g,A[0],A[1],B[0],B[1],color,Math.max(1,Math.round(width*u)))});
    };
    const disc=(p,radius,color,bias=.03)=>{
      const q=projected(p);ops.push({d:q[2]+bias,f:()=>px.disc(g,q[0],q[1],Math.max(.65,radius*u),color)});
    };
    const patch=(joint,vertices,color,part='body',bias=.012)=>polygon(vertices.map(v=>P(joint,...v,part)),color,bias);
    const box=(joint,center,size,color,part='body')=>{
      const [f,r,z]=center,[a,b,c]=size.map(n=>n*.5);
      const v=[[-a,-b,-c],[-a,b,-c],[a,b,-c],[a,-b,-c],[-a,-b,c],[-a,b,c],[a,b,c],[a,-b,c]]
        .map(v=>P(joint,f+v[0],r+v[1],z+v[2],part));
      for(const [indices,tone]of [[[0,1,5,4],-.24],[[1,2,6,5],-.15],[[2,3,7,6],.04],[[3,0,4,7],-.06],[[4,5,6,7],.18],[[0,3,2,1],-.3]])
        polygon(indices.map(i=>v[i]),shade(color,tone));
    };
    const strap=(from,to,width,color,part='body')=>{
      const A=P(...from,part),B=P(...to,part),m=frames[part]||(frames[part]=frame(rig,part));
      const side=[m[1]*width*.5,m[4]*width*.5,m[7]*width*.5];
      polygon([add(A,side),add(B,side),sub(B,side),sub(A,side)],color,.035);
      line(add(A,side),add(B,side),shade(color,.22),.35,.04);
    };

    // Pose-attached lower garments. Each short panel follows its own hip and knee.
    // This avoids the upright hz-based skirt in the source engine during rolled motion.
    const garment=o.nacreGarment;
    if(garment&&garment!=='shawl'){
      const long=garment==='robe'||garment==='coat',len=long?.87:garment==='split'?.47:.52;
      const col=garment==='coat'?(C.coat||shade(C.cloth,-.13)):C.cloth;
      for(const side of ['L','R']){
        const sign=side==='L'?-1:1,hip=J['hip'+side],knee=J['knee'+side],foot=J['foot'+side];
        let hem=mix(hip,knee,len);
        if(long)hem=mix(knee,foot,garment==='robe'?.68:.32);
        const width=garment==='robe'?2.6:garment==='split'?1.5:2.05,top=P(hip,1.8,0,.9,'hips'),low=P(hem,2.0+Math.sin(rig.t*3+sign)*.10,0,0,'hips');
        const backTop=P(hip,-1.45,0,.9,'hips'),backLow=P(hem,-1.8,0,0,'hips');
        const m=frames.hips,edge=[m[1]*width,m[4]*width,m[7]*width];
        polygon([sub(top,edge),add(top,edge),add(low,edge),sub(low,edge)],garment==='apron'?shade(C.trim,-.09):col);
        if(garment!=='apron')polygon([add(backTop,edge),sub(backTop,edge),sub(backLow,edge),add(backLow,edge)],shade(col,-.24));
        line(sub(low,edge),add(low,edge),C.trim,.4);
      }
    }

    // Belts and cuffs use live pelvis / lower-leg anchors, not o.hipZ.
    if(role!=='civilian'||garment==='apron'||garment==='coat'){
      box('hipC',[.0,0,.9],[3.9,o.hipHalf*2+1.4,1.15],C.belt,'hips');
      box('hipC',[2.1,0,.95],[.42,1.3,1.22],C.brass||C.trim,'hips');
    }
    if(role==='player'||role==='guard')for(const side of ['L','R']){
      const cuff=mix(J['knee'+side],J['foot'+side],role==='player'?.35:.47);
      box(cuff,[0,0,0],[2.6,2.9,.65],role==='player'?'#7D7054':'#77766A','leg'+side);
      line(P(cuff,1.25,0,-.4,'leg'+side),P(J['foot'+side],1.2,0,1.1,'leg'+side),shade(C.boot,.22),.45);
    }
    if(role==='player'||role==='guard'||role==='target'){
      const side=role==='player'?'R':'L',sgn=side==='R'?1:-1,anchor='hip'+side;
      const length=role==='player'?6.4:role==='target'?8.2:9.4;
      box(anchor,[-.85,sgn*1.25,-length*.48],[1.1,.95,length],'#3D3A32','hips');
      box(anchor,[-.85,sgn*1.25,.25],[1.30,1.12,.65],C.trim,'hips');
      if(rig._nacreSheathed){
        box(anchor,[-.85,sgn*1.25,1.6],[.8,.85,2.3],'#70523A','hips');
        box(anchor,[-.85,sgn*1.25,.74],[2.35,.75,.45],C.hilt,'hips');
      }
    }

    if(role==='player'){
      // Head cowl: the face remains open; the silhouette is round with a small rear fold.
      const R=o.headR, hood='#1C304A';
      patch('head',[[-.92*R,-.80*R,-.65*R],[-.92*R,.80*R,-.65*R],[-.85*R,.86*R,.68*R],[-1.20*R,0,.92*R],[-.85*R,-.86*R,.68*R]],shade(hood,-.15),'head');
      patch('head',[[-.85*R,-.86*R,.68*R],[-.85*R,.86*R,.68*R],[.57*R,.87*R,.48*R],[.58*R,0,1.16*R],[.57*R,-.87*R,.48*R]],shade(hood,.16),'head');
      for(const s of [-1,1]){
        patch('head',[[-.9*R,s*.83*R,-.66*R],[-.85*R,s*.86*R,.68*R],[.57*R,s*.87*R,.48*R],[.63*R,s*.70*R,-.75*R]],s<0?shade(hood,-.18):hood,'head');
        line(P('head',.63*R,s*.70*R,-.72*R,'head'),P('head',.58*R,s*.86*R,.47*R,'head'),'#69768A',.42);
      }
      // Uneven mantle: left tail lower, right shoulder clear for the weapon arm.
      const flutter=Math.sin(rig.t*5.1)*.12*(.25+Math.min(1,rig.spW||0));
      patch('shC',[[-1.0,-3.9,.5],[-1.0,3.7,.5],[-2.1,4.0,-5.8+flutter],[-2.45,.35,-6.6],[-2.1,-4.45,-8.8+flutter]],C.cape);
      patch('shC',[[.25,-4.0,.3],[1.4,-3.8,-4.1],[1.6,-.6,-2.4],[1.1,1.4,-1.2],[.3,3.65,.2]],shade(C.cape,.2));
      line(P('shC',-2.1,-4.45,-8.8+flutter),P('shC',-2.45,.35,-6.6),C.trim,.45);
      // Scarf is wrapped around the current upper torso with a right-side clasp.
      patch('shC',[[1.6,-2.65,.65],[1.9,2.45,.45],[2.1,2.15,-1.3],[2.0,-1.85,-1.85]],C.scarf);
      patch('shC',[[2.1,1.6,-1.0],[2.4,2.45,-1.2],[2.65,2.8,-4.4],[2.1,1.45,-3.8]],shade(C.scarf,-.12));
      disc(P('shC',2.32,2.02,-.94),.8,C.brass);
      disc(P('shC',2.4,2.03,-.75),.28,'#F4DCAE',.055);
      strap(['shR',1.65,-.15,-1.7],['hipL',1.65,-.7,.5],1.05,'#846344');
      box('hipL',[-.2,-1.55,-1.05],[2.75,2.0,4.4],'#725034','hips');
      box('hipL',[1.28,-1.55,.08],[.38,2.2,1.9],'#997045','hips');
      disc(P('hipL',1.53,-1.55,-.15,'hips'),.45,C.brass);
    }
    else if(role==='guard'){
      const R=o.headR, metal=C.plate,rank=o.nacreRank||0;
      patch('head',[[-.9*R,-.94*R,.05*R],[-.9*R,.94*R,.05*R],[.52*R,.94*R,.20*R],[.65*R,-.94*R,.20*R]],shade(metal,-.17),'head');
      patch('head',[[-.8*R,-.95*R,.25*R],[-.8*R,.95*R,.25*R],[-.20*R,.73*R,.98*R],[-.2*R,-.73*R,.98*R]],metal,'head');
      patch('head',[[-.2*R,-.73*R,.98*R],[-.2*R,.73*R,.98*R],[.66*R,.82*R,.24*R],[.66*R,-.82*R,.24*R]],shade(metal,.2),'head');
      line(P('head',.7*R,-1.10*R,.15*R,'head'),P('head',.7*R,1.10*R,.15*R,'head'),shade(metal,-.3),.65);
      if(rank)line(P('head',.1,-.2,R*.99,'head'),P('head',.1,-.2,R*1.4,'head'),C.brass,rank===2?.85:.5);
      strap(['shL',1.4,.0,-.6],['hipR',2.05,.2,1.5],1.25,'#A38B61');
      for(let i=0;i<=rank;i++)line(P('shC',1.9,-1.2,-2.5-i*.8),P('shC',1.9,.2,-2.5-i*.8),C.brass,.4);
      if(o.nacreRoofWatch){
        patch('shL',[[-1.2,-1.15,.6],[.65,1.2,.45],[.15,1.7,-3.8],[-1.65,-1.2,-4.1]],'#A08455');
        line(P('head',.71*R,-1.02*R,.18*R,'head'),P('head',.71*R,1.02*R,.18*R,'head'),'#BBA579',.45);
      }
    }
    else if(role==='courier'){
      strap(['shL',1.6,.05,-.5],['hipR',1.7,.7,.3],1.45,'#80502F');
      box('hipR',[.15,1.8,-1.0],[3.1,2.55,5.0],'#956232','hips');
      box('hipR',[1.76,1.8,.15],[.4,2.75,2.1],'#BF914A','hips');
      disc(P('hipR',2.01,1.8,-.10,'hips'),.75,C.brass||'#F0D495');
      patch('head',[[-2.5,-2.4,1.55],[-2.5,2.4,1.55],[.7,2.6,2.6],[1.5,-1.8,2.6]],'#98703B','head');
      line(P('head',2.05,-2.5,1.1,'head'),P('head',2.05,2.4,1.1,'head'),'#D7BA7C',.6);
    }
    else if(role==='target'){
      strap(['shL',2.0,.1,-.35],['hipR',2.12,.3,1.3],2.2,C.scarf);
      strap(['shL',2.12,.1,-.40],['hipR',2.24,.3,1.25],.33,C.brass);
      patch('shC',[[1.0,-3.15,.3],[1.6,-2.4,-1.4],[1.8,0,-2.35],[1.6,2.4,-1.4],[1.0,3.15,.3]],'#C6B18A');
      disc(P('shC',2.12,.95,-2.6),.82,C.brass);
      // The ledger is carried only in safe idle. It does not obstruct action motion.
      const state=rig.nacreState||{};
      if((rig.spW||0)<.12&&!weaponVisible(rig)&&!state.dead&&(rig.downW||0)<.1){
        box('handL',[.25,.3,-1.05],[1.15,4.3,5.1],'#71533C','handL');
        box('handL',[.91,.3,-1.05],[.26,3.9,4.65],'#D5C59D','handL');
        box('handL',[1.10,.3,-1.05],[.12,.7,4.9],'#B28D4F','handL');
      }
    }

    if(role==='civilian'){
      if(garment==='shawl')patch('shC',[[.0,-3.8,.5],[.0,3.8,.5],[-1.8,4.15,-7.7],[-2.0,-4.2,-6.2]],shade(C.trim,-.08));
      if(o.nacreHeadwrap){
        patch('head',[[-2.8,-2.8,1.2],[-2.8,2.8,1.2],[.6,2.8,2.0],[1.15,-2.6,2.1]],C.trim,'head');
        line(P('head',1.75,-2.5,1.35,'head'),P('head',1.75,2.5,1.35,'head'),shade(C.trim,.14),.75);
        patch('head',[[-2.2,-2.3,1.6],[-2.8,-3.0,1.4],[-2.3,-3.4,-2.6],[-1.8,-2.6,-2.1]],shade(C.trim,-.16),'head');
      }else if(o.nacreCap){
        patch('head',[[-2.8,-2.8,1.35],[-2.8,2.8,1.35],[1.6,2.8,1.4],[2.25,-1.8,2.4]],shade(C.cloth,-.15),'head');
      }
      const name=String(rig.motionName||'').toLowerCase(), weight=rig.motionWeight===undefined?1:rig.motionWeight;
      if(weight>.12&&name==='drink'){
        box('handR',[.7,.05,.75],[1.8,1.8,2.25],'#B7A17C','handR');
        box('handR',[.7,.05,1.95],[1.84,1.84,.24],'#D0C39B','handR');
        line(P('handR',.65,1.0,1.3,'handR'),P('handR',.65,1.65,.8,'handR'),'#C6B58D',.42);
        line(P('handR',.65,1.65,.8,'handR'),P('handR',.65,1.0,.1,'handR'),'#C6B58D',.42);
      }
      if(weight>.12&&name==='sweep'){
        const middle=mix(J.handL,J.handR,.5);let axis=norm(sub(J.handR,J.handL));
        if(axis[2]<0)axis=mul(axis,-1);
        if(axis[2]<.35)axis=norm([-.22,.05,1]);
        const top=add(middle,mul(axis,5)),end=sub(middle,mul(axis,Math.max(1,(middle[2]-.8)/axis[2])));
        line(top,end,'#9A7845',.65);
        const m=frames.body||(frames.body=frame(rig)),side=[m[1]*3,m[4]*3,m[7]*3];
        const a=add(end,side),b=sub(end,side),lo=[0,0,-.8];
        polygon([a,b,add(b,lo),add(a,lo)],'#B9A05D');
        line(a,b,'#725835',.55);
      }
    }
    if(o.nacreBeard){
      const R=o.headR;
      patch('head',[[.81*R,-.5*R,-.2*R],[.96*R,.5*R,-.2*R],[.8*R,.4*R,-.95*R],[.76*R,-.35*R,-1.08*R]],shade(C.hair,-.1),'head');
      line(P('head',.93*R,-.40*R,-.32*R,'head'),P('head',.93*R,.36*R,-.32*R,'head'),shade(C.hair,.18),.4);
    }
  }

  E.NacreCharacters={version:'1.0.0',options,queue,frame,attachmentPoint,draw,weaponVisible,
    citizenProfiles:citizens.map(c=>c.name)};
})(window.My3D2dge);
