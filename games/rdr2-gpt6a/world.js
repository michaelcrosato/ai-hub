/* Dust & Mercy — original world art, built exclusively with public my-3D2dge APIs. */
(function () {
  'use strict';
  let E, activeWorld, drawnActors=[];
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
  const propExtents = new WeakMap();
  const TAU = Math.PI * 2;
  const locations = {
    camp:{x:220,y:680},town:{x:340,y:400},sheriff:{x:320,y:420},store:{x:400,y:400},saloon:{x:270,y:400},
    stable:{x:260,y:550},clue1:{x:530,y:540},clue2:{x:720,y:450},outlaw:{x:960,y:340},doctor:{x:1010,y:305},
    mine:{x:1050,y:560},fishing:{x:660,y:740},herb:{x:460,y:700},hunter:{x:450,y:610},grave:{x:180,y:330},range:{x:350,y:260}
  };
  const roads = [
    [[245,760],[250,650],[265,550],[300,450],[340,412]],
    [[150,420],[280,418],[430,422],[490,474],[540,548],[680,552],[760,532],[848,437],[945,350],[1070,327]],
    [[760,535],[865,535],[955,557],[1090,575]],
    [[704,573],[710,645],[662,751]],
    [[305,408],[344,289],[350,235]],
    [[242,630],[363,631],[460,696]]
  ];

  function riverX(y) { return 650+Math.sin((y-360)*.012)*32+Math.cos(y*.004)*18; }
  function segDistance(x,y,a,b) { const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))); return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy); }
  function roadDistance(x,y) { let d=9999;for(const road of roads)for(let i=1;i<road.length;i++)d=Math.min(d,segDistance(x,y,road[i-1],road[i]));return d; }
  function protectedAt(x,y,margin=30) { return Object.values(locations).some(p=>Math.hypot(x-p.x,y-p.y)<margin); }
  function poly(g,r,pts,c) { E.px.poly(g,pts.map(p=>r.w(...p)),c); }
  function line(g,r,a,b,c,w=1) {const A=r.w(...a),B=r.w(...b);E.px.line(g,...A,...B,c,w);}
  function box(r,g,x,y,z,w,d,h,top,side) {r.box(g,x-w/2,y-d/2,z,x+w/2,y+d/2,z+h,top,side);}
  // Renderer.queue accepts a projected `box` for its x-ray overlap test (the
  // engine's sprite/prop helpers use it too). This never culls the main image.
  function projectedBox(r,x,y,z,w,d,h) {
    const bounds=[Infinity,Infinity,-Infinity,-Infinity],pad=4+Math.ceil(r.view.scale*4);
    for(const dx of [-w/2,w/2])for(const dy of [-d/2,d/2])for(const dz of [0,h]){
      const p=r.w(x+dx,y+dy,z+dz);bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]);
    }
    return [Math.floor(bounds[0])-pad,Math.floor(bounds[1])-pad,Math.ceil(bounds[2])+pad+1,Math.ceil(bounds[3])+pad+1];
  }
  function near(r,x,y,z=0,margin=160) {const p=r.w(x,y,z);return p[0]>-margin&&p[0]<r.W+margin&&p[1]>-margin&&p[1]<r.H+margin;}
  function directActors(r) {return coarsePointer && r.game.settings.visualDetail !== 'Full';}

  // Only ask the renderer to construct a silhouette when foreground geometry
  // could hide the actor. Props are billboards, so terrain rays alone miss them.
  function needsXray(r,body) {
    if(!activeWorld || r.game.sceneName==='mine')return false;
    const v=r.view,map=activeWorld.map,z=body.z||0,height=body.height||44;
    const foot=r.w(body.x,body.y,z),head=r.w(body.x,body.y,z+height);
    const hw=(body.halfWidth||11)*v.scale;
    const actor=[foot[0]-hw,Math.min(foot[1],head[1])-4,foot[0]+hw,Math.max(foot[1],head[1])+4];
    const order=v.order(body.x,body.y,z)+(body.bias||0);
    const overlap=b=>b[2]>actor[0]&&b[0]<actor[2]&&b[3]>actor[1]&&b[1]<actor[3];
    const close=(x,y)=>Math.abs(x-body.x)<160&&Math.abs(y-body.y)<160&&Math.hypot(x-body.x,y-body.y)<160;
    if(body.actors)for(const a of drawnActors)if(a.owner!==(body.owner||body)&&a.order>order&&overlap(a.bounds))return true;
    if(v.pitchDeg<89){
      let reach=160;
      // Keep the ray inside the level: the engine treats points outside as solid.
      for(const [p,d,max]of [[body.x,v.fx,map.w*map.T-1],[body.y,v.fy,map.h*map.T-1]]){
        if(d>.001)reach=Math.min(reach,(max-p)/d);else if(d<-.001)reach=Math.min(reach,(1-p)/d);
      }
      if(reach>1)for(const lift of [8,height*.65]){
        const start={x:body.x,y:body.y,z:z+lift};
        const end={x:body.x+v.fx*reach,y:body.y+v.fy*reach,z:z+lift+reach*Math.tan(v.pitch)/v.zBoost};
        if(!map.ray(start,end).clear)return true;
      }
    }
    const zoom=v.zoom||1,styleSize=E.style.propSize||1;
    for(const p of activeWorld.props){
      if(p.opts.hides===false||!close(p.x,p.y)||v.order(p.x,p.y,p.z||0)+(p.opts.bias||0)<=order)continue;
      let extent=propExtents.get(p);
      if(!extent||extent.zoom!==zoom||extent.styleSize!==styleSize){
        const options=zoom===1?p.opts:{...p.opts,size:(p.opts.size||1)*zoom},asset=E.prop(p.name,options);
        extent={zoom,styleSize,w:asset.w,h:asset.h};propExtents.set(p,extent);
      }
      const point=r.w(p.x,p.y,p.z||0),top=p.opts.anchor==='top'?point[1]:point[1]-extent.h;
      if(overlap([point[0]-extent.w/2,top,point[0]+extent.w/2,top+extent.h]))return true;
    }
    const volume=(x,y,w,d,h,front)=>{
      if(!close(x,y)||v.order(x,front,0)<=order)return false;
      const bounds=[Infinity,Infinity,-Infinity,-Infinity];
      for(const dx of [-w/2,w/2])for(const dy of [-d/2,d/2])for(const dz of [0,h]){
        const p=r.w(x+dx,y+dy,dz);bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]);
      }
      return overlap(bounds);
    };
    for(const b of activeWorld.decor.buildings)if(volume(b.x,b.y,b.w+12,b.d+28,b.h+(b.chapel?46:20),b.y+b.d/2))return true;
    for(const t of activeWorld.decor.tents)if(volume(t.x,t.y,t.w,t.d,t.h,t.y+t.d/2))return true;
    for(const w of activeWorld.decor.wagons)if(volume(w.x-10,w.y,70,28,w.covered?42:29,w.y+13))return true;
    return false;
  }

  function build(engine) {
    E=engine;
    const random=E.rng(1887),cells=Array(80*64).fill(0),floor=Array(80*64).fill('grass'),blocked=Array(80*64).fill(0);
    const buildings=[
      {x:255,y:348,w:80,d:48,h:49,name:'THE COPPER SPUR',color:'#997154',roof:'#735347',saloon:true},
      {x:345,y:352,w:48,d:40,h:36,name:'SHERIFF',color:'#a18c67',roof:'#665346'},
      {x:424,y:351,w:72,d:44,h:43,name:'GENERAL STORE',color:'#8c8768',roof:'#4f5a50',store:true},
      {x:240,y:486,w:72,d:46,h:38,name:'LIVERY',color:'#947653',roof:'#70634c',stable:true},
      {x:952,y:264,w:70,d:42,h:33,name:'',color:'#8c6751',roof:'#604e44',ruined:true},
      {x:1060,y:460,w:64,d:38,h:30,name:'ASSAY OFFICE',color:'#8a7a60',roof:'#645d50'},
      {x:118,y:290,w:42,d:54,h:45,name:'',color:'#bbb396',roof:'#6c756b',chapel:true}
    ];
    const types={
      1:{h:24,top:'#bdab86',side:'#89795f',face:'rock',roof:'speckle',cut:true,cutH:9},
      2:{h:36,top:'#9d896d',side:'#8c7155',face:'plank',roof:'plain',cut:false},
      3:{h:12,top:'#b08c59',side:'#7d603d',face:'timber',roof:'plain',cut:false},
      4:{h:42,top:'#c2ac86',side:'#806d59',face:'rock',roof:'speckle',cut:false},
      5:{h:8,top:'#b4a37a',side:'#877353',face:'rock',roof:'speckle',cut:false}
    };
    for(let cy=0;cy<64;cy++)for(let cx=0;cx<80;cx++){
      const x=cx*16+8,y=cy*16+8,i=cy*80+cx,rx=riverX(y),water=Math.abs(x-rx)<30,bridge=y>=528&&y<576&&x>585&&x<745;
      floor[i]=x>815?'sand':'grass';
      if(Math.abs(x-rx)<49)floor[i]='bank';
      if(water){floor[i]='water';blocked[i]=1;}
      if(roadDistance(x,y)<15&&!water)floor[i]='road';
      if(x>176&&x<478&&y>386&&y<451)floor[i]='road';
      if(Math.hypot((x-220)*.8,y-680)<75)floor[i]='camp';
      if(bridge){floor[i]='bridge';blocked[i]=0;}
      if(cx<2||cy<2||cx>77||cy>61)cells[i]=4;
      if((y<190||x>1150||x<65)&&!water&&E.hash2(cx,cy)>.49)cells[i]=E.hash2(cx+1,cy)>.5?1:4;
    }
    for(const b of buildings){
      const id=6+buildings.indexOf(b);types[id]={h:b.h,top:b.roof,side:b.color,face:'plank',roof:'plain',cut:false};
      for(let cy=Math.ceil((b.y-b.d/2)/16);cy<Math.floor((b.y+b.d/2)/16);cy++)for(let cx=Math.ceil((b.x-b.w/2)/16);cx<Math.floor((b.x+b.w/2)/16);cx++)cells[cy*80+cx]=id;
    }
    // The ridge is genuinely raised terrain: low shelves lead to climbable sandstone.
    for(const [cx,cy,w,h,id] of [[54,13,12,2,4],[56,15,5,1,1],[65,30,6,2,4],[69,32,3,1,1],[50,22,2,3,1],[50,25,2,1,5],[28,21,2,1,3],[17,29,2,1,3],[58,20,2,1,3],[66,36,2,1,3]]){
      for(let yy=cy;yy<cy+h;yy++)for(let xx=cx;xx<cx+w;xx++)if(!protectedAt(xx*16+8,yy*16+8,32)&&roadDistance(xx*16+8,yy*16+8)>20)cells[yy*80+xx]=id;
    }
    // Every authored interaction point has space for the player, horse and companion.
    for(const p of Object.values(locations))for(let cy=Math.floor((p.y-23)/16);cy<=Math.floor((p.y+23)/16);cy++)for(let cx=Math.floor((p.x-23)/16);cx<=Math.floor((p.x+23)/16);cx++){
      const i=cy*80+cx;cells[i]=0;blocked[i]=0;if(floor[i]==='water')floor[i]='bank';
    }
    const pal={grass:{base:'#9d9c68',dark:'#8c915f',light:'#b7ad77',flower:'#d4bd7a',flower2:'#cbbb85'},sand:{base:'#b6a176',dark:'#aa936e',light:'#c7b184'},road:{base:'#b99c76',dark:'#a88d6d',light:'#c6ab85'},bank:{base:'#a49f79',dark:'#8a9071',light:'#b6ab87'},camp:{base:'#a79972',dark:'#918665',light:'#b5a47a'},water:{base:'#577c78',dark:'#466e6c',light:'#9db4a0'},bridge:{base:'#a48d6a',dark:'#928060',line:'#635e48'}};
    const map=new E.TileMap({w:80,h:64,cells,floor,blocked,types,ao:3,floorTex(x,y,tag){
      if(tag==='bridge')return E.tex.planks(y,x,pal.bridge);
      if(x>304&&x<373&&y>385&&y<412)return E.tex.flagstone(x,y,{stones:['#a59c7d','#9c967a'].map(E.hex),mortar:E.hex('#817c66'),hi:E.hex('#b8ad8a'),lo:E.hex('#8a846d'),speck:E.hex('#a09b7e')});
      if(x>244&&x<294&&y>380&&y<396)return E.tex.checker(x,y,{a:'#8c775b',b:'#ae9570',size:8});
      if(x>385&&x<445&&y>385&&y<397)return E.tex.plain(x,y,{base:'#aa9574',amount:5});
      const bankDistance=Math.abs(x-riverX(y));
      if(bankDistance<28)return E.tex.water(x,y,pal.water);
      if(tag==='water'||bankDistance<38)return E.tex.dirt(x,y,pal.bank);
      if(tag==='grass')return E.tex.grass(x,y,pal.grass);
      return E.tex.dirt(x,y,pal[tag]||pal.sand);
    }});
    const props=[],decor={buildings,tents:[{x:170,y:642,w:36,d:35,h:27,color:'#d0bc90'},{x:260,y:630,w:29,d:28,h:23,color:'#9caa94'}],wagons:[{x:307,y:661,covered:true},{x:484,y:395,covered:false},{x:896,y:315,covered:false},{x:518,y:519,covered:false,broken:true}],fences:[],graves:[],birds:[]};
    function add(name,x,y,size,color,extra={}){props.push({name,x,y,z:0,opts:{size,color,variant:Math.floor(random()*5),...extra}});}
    for(let i=0;i<470;i++){
      const x=45+random()*1190,y=62+random()*904,[cx,cy]=map.toCell(x,y);
      if(!map.walkable(cx,cy)||protectedAt(x,y,38)||roadDistance(x,y)<23||buildings.some(b=>Math.abs(x-b.x)<b.w/2+14&&Math.abs(y-b.y)<b.d/2+23))continue;
      const forest=x<530&&y<330||x<150||y>815;
      if(forest&&random()<.5)add('pine',x,y,1.5+Math.floor(random()*4)*.3,['#53654e','#5e6e51','#6b7552'][i%3]);
      else if(x>820&&random()<.14)add('cactus',x,y,1.1+Math.floor(random()*3)*.3,'#7c8760');
      else if(random()<.22)add('rock',x,y,.9+Math.floor(random()*4)*.4,['#a79a7d','#8d8b76','#b7a387'][i%3]);
      else if(random()<.43)add('bush',x,y,.65+Math.floor(random()*3)*.25,['#7f8961','#7b886c','#8f946d'][i%3]);
      else add('grass',x,y,.7+Math.floor(random()*3)*.2,['#b8ac73','#9b9d6f','#c4b57d'][i%3]);
    }
    // Authored silhouettes frame the camp and settlements without hiding their entrances.
    for(const [x,y,s] of [[100,660,2.4],[124,740,2.6],[340,737,2.5],[360,662,1.8],[140,593,2.2],[175,490,2.6],[501,356,2.5],[518,419,2],[182,240,2.4],[426,208,2.7],[748,647,2.1],[735,703,2.5],[560,747,2.2]])add('pine',x,y,s,'#5f6b50');
    for(const [name,x,y,size,color] of [
      ['barrel',302,375,1.4,'#927552'],['barrel',305,385,1.25,'#8c7253'],['crate',460,376,1.35,'#ac9067'],['crate',475,375,1,'#a08963'],
      ['lantern',225,376,1.1,'#776c51'],['lantern',285,376,1.1,'#776c51'],['lantern',393,376,1,'#807458'],
      ['sign',320,386,1.4,'#ad9470'],['sign',454,394,1.2,'#a88f68'],['barrel',210,517,1.3,'#918060'],
      ['crate',275,649,1.35,'#9e8258'],['barrel',284,671,1.2,'#917a54'],['pot',202,693,1.25,'#706a55'],['chest',186,659,1.15,'#94754d'],
      ['brazier',230,704,.9,'#66554b'],['bones',791,397,1.2,'#c2b99b'],['skull',990,400,.9,'#c4b8a0'],
      ['barrel',917,295,1.2,'#8b7150'],['crate',970,372,1.35,'#997b52'],['sandbags',914,352,1.25,'#b3a078'],
      ['crate',1066,586,1.3,'#917852'],['lantern',1024,526,1.2,'#75654d'],['crystal',1100,520,.8,'#b49b62'],
      ['flowers',456,701,1.1,'#bda65e'],['flowers',474,709,.85,'#b09a62'],['mushroom',446,692,.8,'#b3aa80'],
      ['bush',621,722,1.1,'#657d66'],['grass',637,761,1.2,'#a7b087']
    ])add(name,x,y,size,color,{light:name==='lantern'||name==='brazier',haloR:22});
    for(let x=188;x<=316;x+=24)decor.fences.push({x,y:584,len:22});
    for(let x=155;x<213;x+=23)decor.fences.push({x,y:316,len:21});
    for(let i=0;i<5;i++)decor.graves.push({x:139+(i%3)*23,y:342+Math.floor(i/3)*29,z:0});
    for(let i=0;i<7;i++)decor.birds.push({x:330+i*106,y:250+(i%3)*97,phase:random()*TAU});
    const animals=[
      {id:'deer1',kind:'deer',x:435,y:598},{id:'deer2',kind:'deer',x:483,y:591},{id:'deer3',kind:'deer',x:388,y:774},
      {id:'rabbit1',kind:'rabbit',x:430,y:724},{id:'rabbit2',kind:'rabbit',x:808,y:702},{id:'rabbit3',kind:'rabbit',x:190,y:576}
    ].map((a,i)=>({...a,z:0,homeX:a.x,homeY:a.y,facing:i*.8,hp:1,alive:true,phase:i*1.7,rig:a.kind==='rabbit'?new E.Blob({R:3.4,ears:'rabbit',feet:true,tail:true,colors:{dk:'#82735c',base:'#b7a68b',lt:'#d9c9a8',spec:'#e3d7ba',eye:'#2e2922',pupil:'#101716'}}):null}));
    activeWorld={map,props,locations:JSON.parse(JSON.stringify(locations)),animals,decor,roads,riverX};
    return activeWorld;
  }

  function drawBuilding(r,b,state) {
    if(!near(r,b.x,b.y,20))return;
    const x0=b.x-b.w/2,x1=b.x+b.w/2,y0=b.y-b.d/2,y1=b.y+b.d/2,h=b.h;
    const maskBounds=projectedBox(r,b.x,b.y,0,b.w+14,b.d+40,b.h+(b.chapel?65:24));
    // Signs stay horizontal in screen space, including at low zoom and 90° yaw.
    if(b.name){const p=r.w(b.x,y1+1.9,h+6),half=E.font.width(b.name,{font:'tiny'})/2;maskBounds[0]=Math.min(maskBounds[0],Math.floor(p[0]-half)-3);maskBounds[1]=Math.min(maskBounds[1],Math.floor(p[1])-3);maskBounds[2]=Math.max(maskBounds[2],Math.ceil(p[0]+half)+4);maskBounds[3]=Math.max(maskBounds[3],Math.ceil(p[1])+10);}
    r.shadow(b.x+6,b.y+7,b.w*.48,.22,'#454a3d');
    r.queue(b.x,y1,0,g=>{
      box(r,g,b.x,b.y,0,b.w,b.d,h,b.color,b.color);
      // Long, aged timber siding and the heavy corner posts.
      for(let z=5;z<h;z+=5){line(g,r,[x0,y1+.1,z],[x1,y1+.1,z],'#695840');line(g,r,[x1+.1,y0,z],[x1+.1,y1,z],'#69583f');}
      for(const x of [x0+2,x1-2])box(r,g,x,y1,0,3,3,h+1,'#c2aa7e','#685640');
      for(let x=x0+11;x<x1-8;x+=22){
        if(Math.abs(x-b.x)<10)continue;
        poly(g,r,[[x-5,y1+.4,13],[x+5,y1+.4,13],[x+5,y1+.4,28],[x-5,y1+.4,28]],'#403e32');
        poly(g,r,[[x-4,y1+.5,15],[x+4,y1+.5,15],[x+4,y1+.5,27],[x-4,y1+.5,27]],state.night?'#d7a456':'#84948a');
        line(g,r,[x,y1+.6,15],[x,y1+.6,27],'#d3b88a',1);line(g,r,[x-5,y1+.6,21],[x+5,y1+.6,21],'#d3b88a',1);
        line(g,r,[x-6,y1+.7,12],[x+6,y1+.7,12],'#b49c73',2);
      }
      poly(g,r,[[b.x-6,y1+.5,0],[b.x+6,y1+.5,0],[b.x+6,y1+.5,26],[b.x-6,y1+.5,26]],'#4f4637');
      poly(g,r,[[b.x-4.8,y1+.6,1],[b.x+4.8,y1+.6,1],[b.x+4.8,y1+.6,24],[b.x-4.8,y1+.6,24]],'#6a533b');
      const knob=r.w(b.x+3,y1+.7,12);E.px.disc(g,...knob,1,'#cfaf6c');
      box(r,g,b.x,y1+6,0,b.w+8,12,3,'#ad926c','#746047');
      for(let x=x0-3;x<x1+3;x+=7)line(g,r,[x,y1+.2,3.2],[x,y1+11,3.2],'#7b654b');
      if(b.saloon||b.store||b.stable){
        for(const x of [x0+1,x1-1])box(r,g,x,y1+10,3,2.4,2.4,27,'#c1a581','#82684c');
        poly(g,r,[[x0-5,y1-2,35],[x1+5,y1-2,35],[x1+5,y1+15,30],[x0-5,y1+15,30]],b.store?'#7c8170':'#a38968');
        line(g,r,[x0-5,y1+15,30],[x1+5,y1+15,30],'#c2ab82',2);
      }
      const ridge=h+(b.chapel?21:14);
      poly(g,r,[[x0-5,y0-4,h],[x1+5,y0-4,h],[x1+5,b.y,ridge],[x0-5,b.y,ridge]],'#74675a');
      poly(g,r,[[x0-5,b.y,ridge],[x1+5,b.y,ridge],[x1+5,y1+3,h],[x0-5,y1+3,h]],b.roof);
      for(let y=b.y+4;y<y1+2;y+=5){const z=ridge-(y-b.y)/(y1+3-b.y)*(ridge-h);line(g,r,[x0-5,y,z],[x1+5,y,z],'#4e493d');}
      for(let x=x0+2;x<x1;x+=13)line(g,r,[x,b.y,ridge+.2],[x+3,y1+3,h+.2],'#8b7a60');
      line(g,r,[x0-5,b.y,ridge],[x1+5,b.y,ridge],'#b19a75',2);
      if(b.name){
        const sy=y1+.9,top=h+8,bot=h-3;
        poly(g,r,[[x0+1,sy,bot],[x1-1,sy,bot],[x1-1,sy,top],[x0+1,sy,top]],'#6f543a');
        line(g,r,[x0,sy+.1,top],[x1,sy+.1,top],'#c4aa7b',2);line(g,r,[x0,sy+.1,bot],[x1,sy+.1,bot],'#b1976d',1);
        const p=r.w(b.x,sy+1,top-2);E.font.text(g,b.name,p[0],p[1]+1,'#e4ce9b',{align:'center',font:'tiny',shadow:'#4a392a'});
      }
      if(b.chapel){box(r,g,b.x,b.y, h+5,16,16,27,'#cec1a0','#aea286');box(r,g,b.x,b.y,h+32,2,2,12,'#ded1ae','#a99778');box(r,g,b.x,b.y,h+39,10,2,2,'#ded1ae','#a99778');}
      if(!b.stable&&!b.ruined)box(r,g,x1-13,b.y-8,h+3,7,8,17,'#af997b','#88705a');
    },{hides:true,solid:true,footprint:[x0,y0,x1,y1],box:maskBounds});
  }

  function drawTent(r,t) {
    r.shadow(t.x+4,t.y+3,t.w*.65,.2,'#454936');
    r.queue(t.x,t.y+t.d/2,0,g=>{
      const x=t.x,y=t.y,w=t.w/2,d=t.d/2;
      poly(g,r,[[x-w,y-d,0],[x,y-d,t.h],[x,y+d,t.h],[x-w,y+d,0]],'#b6aa86');
      poly(g,r,[[x,y-d,t.h],[x+w,y-d,0],[x+w,y+d,0],[x,y+d,t.h]],t.color);
      poly(g,r,[[x-w,y+d,0],[x,y+d,t.h],[x+w,y+d,0]],'#b6a786');
      poly(g,r,[[x-w*.68,y+d+.2,0],[x,y+d+.2,t.h*.86],[x+w*.48,y+d+.2,0]],'#555345');
      poly(g,r,[[x,y+d+.4,t.h],[x+w*.3,y+d+.4,2],[x+w,y+d+.4,0]],t.color);
      line(g,r,[x,y-d-3,t.h],[x,y+d+3,t.h],'#e0cda4',2);
      for(const sign of [-1,1]){line(g,r,[x,y+sign*d,t.h],[x+sign*10,y+sign*(d+16),0],'#9f9477');line(g,r,[x+sign*10,y+sign*(d+16),0],[x+sign*10,y+sign*(d+16),3],'#5c523e',2);}
      box(r,g,x,y+d+1,0,2,2,t.h,'#bfaa7a','#766348');
    },{hides:true,solid:true,box:projectedBox(r,t.x,t.y,0,t.w+24,t.d+40,t.h+5)});
  }

  function drawWagon(r,w) {
    if(!near(r,w.x,w.y))return;
    r.shadow(w.x+4,w.y,24,.25,'#4b4937');
    r.queue(w.x,w.y+13,0,g=>{
      const x=w.x,y=w.y;
      for(const sy of [-12,12])for(const sx of [-15,15]){
        if(w.broken&&sx===-15&&sy===12)continue;
        const p=r.w(x+sx,y+sy,7),z=r.view.scale;
        E.px.ell(g,p[0],p[1],7*z,7*z,'#4c493d');E.px.ell(g,p[0],p[1],5.4*z,5.4*z,'#a38b5e');E.px.ell(g,p[0],p[1],4*z,4*z,'#6e674c');
        for(let i=0;i<4;i++){const a=i*Math.PI/4;E.px.line(g,p[0]-Math.cos(a)*5*z,p[1]-Math.sin(a)*5*z,p[0]+Math.cos(a)*5*z,p[1]+Math.sin(a)*5*z,'#b59e6b',1);}
        E.px.disc(g,p[0],p[1],2*z,'#746043');
      }
      box(r,g,x,y,8,40,22,5,'#b79b6b','#8b704b');
      box(r,g,x,y-10,13,41,2,11,'#c4aa78','#937e55');box(r,g,x,y+10,13,41,2,11,'#c4aa78','#937e55');
      for(let z=17;z<25;z+=4)line(g,r,[x-20,y+11,z],[x+20,y+11,z],'#5e553e');
      for(const xx of [-15,14])box(r,g,x+xx,y+11,11,2,2,17,'#bba476','#766346');
      if(w.covered){
        const N=10;
        for(let i=0;i<N;i++){const a=i/N*Math.PI,b=(i+1)/N*Math.PI;const y0=y+Math.cos(a)*12,z0=24+Math.sin(a)*16,y1=y+Math.cos(b)*12,z1=24+Math.sin(b)*16;poly(g,r,[[x-18,y0,z0],[x+16,y0,z0],[x+16,y1,z1],[x-18,y1,z1]],i<5?'#c8bb98':'#b7ac8b');}
        for(const xx of [-18,-7,5,16])for(let i=0;i<N;i++){const a=i/N*Math.PI,b=(i+1)/N*Math.PI;line(g,r,[x+xx,y+Math.cos(a)*12,24+Math.sin(a)*16],[x+xx,y+Math.cos(b)*12,24+Math.sin(b)*16],'#8f886d');}
      }else{box(r,g,x-8,y,13,12,13,12,'#b59869','#867047');box(r,g,x+7,y,13,11,10,7,'#bca474','#8b7654');}
      line(g,r,[x-20,y-7,11],[x-45,y-7,7],'#7c6849',2);line(g,r,[x-20,y+7,11],[x-45,y+7,7],'#7c6849',2);
      if(w.broken){
        const p=r.w(x+30,y+24,3),s=r.view.scale;
        E.px.ell(g,...p,8*s,3.5*s,'#4d4939');E.px.ell(g,...p,6*s,2.5*s,'#ad9063');E.px.ell(g,...p,4.7*s,1.6*s,'#655d43');
        for(let i=0;i<4;i++){const a=i*Math.PI/4;E.px.line(g,p[0]-Math.cos(a)*6*s,p[1]-Math.sin(a)*2.5*s,p[0]+Math.cos(a)*6*s,p[1]+Math.sin(a)*2.5*s,'#c0a474');}
        line(g,r,[x-15,y-11,8],[x-15,y+6,6],'#756447',3);line(g,r,[x-15,y+6,6],[x-20,y+14,2],'#d0b080',2);
        for(const [ax,ay,bx,by]of [[11,23,34,32],[19,36,39,25],[3,30,18,35]])line(g,r,[x+ax,y+ay,1],[x+bx,y+by,1],'#a2855a',2);
      }
    },{hides:true,solid:true,box:w.broken?projectedBox(r,w.x-4,w.y+10,0,108,84,48):projectedBox(r,w.x-12,w.y,0,76,40,48)});
  }

  function drawDeer(r,a,time) {
    if(!near(r,a.x,a.y))return;
    r.shadow(a.x,a.y,12,.17,'#475040');
    const angle=a.facing||0,c=Math.cos(angle),s=Math.sin(angle),moving=Math.hypot(a.vx||0,a.vy||0)>.3;
    const p=(f,q,z)=>r.w(a.x+f*c-q*s,a.y+f*s+q*c,z);
    r.queue(a.x,a.y,0,g=>{
      const limb=(a,b,col,width)=>E.px.line(g,...p(...a),...p(...b),col,width*r.view.scale);
      for(const side of [-1,1])for(const f of [-7,7]){const phase=time*8+a.phase+(f>0?0:Math.PI)+(side>0?Math.PI:0),step=moving?Math.sin(phase)*4:0;limb([f,side*2.5,16],[f+step,side*2.5,1],'#705c44',1.4);}
      const q=[[-10,0,18],[-7,0,23],[7,0,22],[11,0,15],[6,0,12],[-7,0,13]].map(v=>p(...v));E.px.poly(g,q,'#ab8d65');
      limb([-7,-2,21],[6,-2,21],'#cfaf7c',3.1);limb([7,0,18],[13,0,31],'#ac8b62',4);limb([13,0,31],[19,0,29],'#b99a6d',3.2);
      limb([14,-1,32],[13,-4,36],'#8c7757',1.4);limb([15,1,32],[16,4,35],'#a99169',1.5);limb([18,0,29],[20,0,29],'#504c3c',1.7);
      limb([-10,0,18],[-14,0,21],'#ddd0ae',2.4);
      if(a.id==='deer1'){for(const side of [-1,1]){limb([13,side,33],[9,side*3,40],'#71634b',1);limb([10,side*3,38],[6,side*4,40],'#71634b',1);}}
      const eye=p(16,2,31);E.px.disc(g,...eye,1,'#2e322b');
    },{solid:true});
  }

  function draw(r,game,world,state={}) {
    E=E||globalThis.My3D2dge;drawnActors=[];const time=state.time||0;
    r.sky(state.night?['#202c31','#3c4a45','#77745a']:['#989f83','#bbc0a0','#d0bd91']);if(state.night)r.starfield({count:65,speed:1,dir:'left'});
    world.map.drawFloor(r);world.map.queueWalls(r);
    // Wagon ruts and meandering worn paths remain ground decals, under feet and shadows.
    r.decal(g=>{
      for(const road of roads)for(let j=1;j<road.length;j++)if(near(r,(road[j][0]+road[j-1][0])/2,(road[j][1]+road[j-1][1])/2,0,230)){
        const a=road[j-1],b=road[j],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*5,ny=dx/len*5;
        for(const sign of [-1,1])line(g,r,[a[0]+nx*sign,a[1]+ny*sign,0],[b[0]+nx*sign,b[1]+ny*sign,0],'#ac9471');
      }
      if(near(r,230,704))for(let i=0;i<12;i++){const a=i/12*TAU,p=r.w(230+Math.cos(a)*10,704+Math.sin(a)*8,1);E.px.ell(g,...p,3*r.view.scale,2*r.view.scale,i%2?'#827762':'#a89c7e');}
      if(near(r,660,740))for(let i=0;i<5;i++){const x=620+i*7,y=730+Math.sin(time*.7+i)*2,p=r.w(x,y,0);E.px.line(g,p[0],p[1],p[0]+5,p[1],'#bed0b5');}
    });
    // Open timber bridge: the deck's collision comes from the map's plank cells.
    if(near(r,666,552))for(const y of [529,576])r.queue(666,y,0,g=>{
      for(let x=597;x<740;x+=23)box(r,g,x,y,0,3,3,13,'#b8a67e','#756d53');
      line(g,r,[597,y,11],[735,y,11],'#bbaa83',2);line(g,r,[597,y,6],[735,y,6],'#7e775b',2);
    },{hides:true,solid:true,box:projectedBox(r,666,y,0,150,8,18)});
    for(const b of world.decor.buildings)drawBuilding(r,b,state);
    for(const t of world.decor.tents)if(near(r,t.x,t.y))drawTent(r,t);
    for(const w of world.decor.wagons)drawWagon(r,w);
    for(const p of world.props)if(near(r,p.x,p.y,0,105))r.prop(p.name,p.x,p.y,p.z||0,p.opts);
    for(const f of world.decor.fences)if(near(r,f.x,f.y))r.queue(f.x,f.y,0,g=>{
      for(const x of [f.x,f.x+f.len])box(r,g,x,f.y,0,2,2,13,'#baa481','#80704f');
      for(const z of [5,10])line(g,r,[f.x,f.y,z],[f.x+f.len,f.y,z],'#b59f77',2);
    },{hides:true,box:projectedBox(r,f.x+f.len/2,f.y,0,f.len+6,6,17)});
    for(const grave of world.decor.graves)if(near(r,grave.x,grave.y))r.queue(grave.x,grave.y,0,g=>{
      box(r,g,grave.x,grave.y+7,0,9,15,1,'#9b956e','#716d52');box(r,g,grave.x,grave.y,0,7,2,13,'#b9b296','#8d8c78');
      line(g,r,[grave.x,grave.y+1.2,5],[grave.x,grave.y+1.2,11],'#797966');line(g,r,[grave.x-2,grave.y+1.2,9],[grave.x+2,grave.y+1.2,9],'#797966');
    },{box:projectedBox(r,grave.x,grave.y+5,0,14,23,17)});
    // A deep, braced mine opening cut into the sandstone shelf.
    if(near(r,1050,523))r.queue(1050,525,0,g=>{
      poly(g,r,[[1029,526,0],[1029,526,30],[1040,526,40],[1063,526,40],[1073,526,29],[1073,526,0]],'#544f40');
      poly(g,r,[[1036,526.2,0],[1036,526.2,29],[1043,526.2,33],[1059,526.2,33],[1067,526.2,27],[1067,526.2,0]],'#242e29');
      box(r,g,1034,527,0,5,5,33,'#b29666','#796342');box(r,g,1069,527,0,5,5,33,'#b29666','#796342');box(r,g,1051,527,31,40,5,5,'#bba173','#806c4b');
      for(const x of [1046,1057])line(g,r,[x,530,0],[x,573,0],'#666952',2);
      for(let y=533;y<575;y+=7)line(g,r,[1042,y,0],[1061,y,0],'#7e6b4c',2);
    },{solid:true,hides:true,box:projectedBox(r,1051,547,0,54,58,46)});
    // A recognizable practiced shooting range, including the bell and painted bullseyes.
    for(let i=0;i<3;i++){const x=325+i*29,y=223;if(near(r,x,y))r.queue(x,y,0,g=>{
      box(r,g,x,y,0,2,2,23,'#b9a17c','#7f6d4c');const p=r.w(x,y,24),s=r.view.scale;
      E.px.disc(g,...p,7*s,'#cbbb92');E.px.disc(g,...p,5*s,'#885846');E.px.disc(g,...p,3*s,'#c9ba92');E.px.disc(g,...p,1.2*s,'#7c4e3d');
    });}
    for(const a of world.animals){if(a.alive===false)continue;if(a.kind==='deer')drawDeer(r,a,time);else if(a.rig&&near(r,a.x,a.y)){r.shadow(a.x,a.y,5,.16);r.actor(a.x,a.y,a.z||0,(g,x,y)=>a.rig.draw(g,x,y,r.view),directActors(r)?{outline:false,rim:false}:{});}}
    // The windmill slowly turns above the stable; the moving vanes are world geometry.
    if(near(r,177,499,40))r.queue(177,499,0,g=>{
      const x=177,y=499;for(const dx of [-7,7])line(g,r,[x+dx,y+dx*.5,0],[x,y,57],'#7c7055',2);
      for(let z=12;z<50;z+=13)line(g,r,[x-7*(1-z/57),y,z],[x+7*(1-z/57),y,z],'#a48f6a');
      for(let i=0;i<8;i++){const a=i/8*TAU+time*.28,b=a+.4;poly(g,r,[[x+Math.cos(a)*5,y,57+Math.sin(a)*5],[x+Math.cos(a)*17,y,57+Math.sin(a)*17],[x+Math.cos(b)*16,y,57+Math.sin(b)*16],[x+Math.cos(b)*7,y,57+Math.sin(b)*7]],i%2?'#bbb89e':'#9b9e87');}
      const p=r.w(x,y,57);E.px.disc(g,...p,2*r.view.scale,'#d2c9aa');
    },{hides:true,box:projectedBox(r,177,499,0,42,18,81)});
    // Distant circling birds create motion without adding scene noise near interaction prompts.
    for(const bird of world.decor.birds){const x=bird.x+Math.cos(time*.12+bird.phase)*35,y=bird.y+Math.sin(time*.12+bird.phase)*20,z=75+Math.sin(time*.7+bird.phase)*4;if(!near(r,x,y,z,20))continue;r.queue(x,y,z,g=>{const p=r.w(x,y,z),flap=Math.sin(time*2+bird.phase)*2;E.px.line(g,p[0]-4,p[1]+flap,p[0],p[1],'#555f50');E.px.line(g,p[0],p[1],p[0]+4,p[1]+flap,'#555f50');});}
    if(game.lights&&near(r,230,704))game.lights.add(230,704,9,65,.5+Math.sin(time*8)*.08,{color:'#ffb35b'});
  }

  function drawHorse(r,engine,body,opts={}) {
    E=engine;const time=opts.t||0,ang=body.facing||0,c=Math.cos(ang),s=Math.sin(ang),z=body.z||0;
    const speed=Math.hypot(body.vx||0,body.vy||0),run=Math.min(1,speed/70),phase=body.gaitPhase===undefined?time*(5+run*7):body.gaitPhase,bob=Math.sin(phase*2)*run*1.1+Math.sin(time*1.8)*.25;
    const world=(f,q,h)=>[body.x+f*c-q*s,body.y+f*s+q*c,z+h];
    r.shadow(body.x+3,body.y,21,.29,'#41473a');
    r.queue(body.x,body.y,z,g=>{
      const ops=[],sc=r.view.scale,P=p=>r.w(...world(...p));
      const face=(pts,col)=>{const avg=pts.reduce((a,b)=>a.map((v,i)=>v+b[i]/pts.length),[0,0,0]),w=world(...avg);ops.push({d:r.view.depth(...w),fn:()=>E.px.poly(g,pts.map(P),col)});};
      const limb=(a,b,col,width,depth=0)=>{const w=world((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);ops.push({d:r.view.depth(...w)+depth,fn:()=>{const A=P(a),B=P(b);E.px.line(g,...A,...B,col,width*sc);E.px.disc(g,...A,width*sc*.5,col);E.px.disc(g,...B,width*sc*.5,col);}});};
      const mesh=(rings,colors)=>{for(let j=1;j<rings.length;j++)for(let i=0;i<8;i++){const a=i/8*TAU,b=(i+1)/8*TAU,A=rings[j-1],B=rings[j];face([[A[0],Math.cos(a)*A[2],A[1]+Math.sin(a)*A[3]],[B[0],Math.cos(a)*B[2],B[1]+Math.sin(a)*B[3]],[B[0],Math.cos(b)*B[2],B[1]+Math.sin(b)*B[3]],[A[0],Math.cos(b)*A[2],A[1]+Math.sin(b)*A[3]]],colors[i%colors.length]);}};
      // Four independently articulated legs; diagonal pairs agree at the trot.
      for(const side of [-1,1])for(const front of [-1,1]){
        const f=front>0?11:-12,p=phase+(front===side?0:Math.PI),swing=Math.sin(p)*run*7,lift=Math.max(0,Math.cos(p))*run*5;
        const hip=[f,side*4.3,23+bob],knee=[f+swing*.55+(front>0?-1:3),side*4.7,11+lift*.55],hoof=[f+swing,side*4.8,2+lift];
        limb(hip,knee,side<0?'#725041':'#93674e',3.2);limb(knee,hoof,side<0?'#5d4839':'#a27856',1.8);
        limb([hoof[0],hoof[1],hoof[2]+3],hoof,front<0?'#d6c4a0':'#9c785a',1.7);limb([hoof[0]-.5,hoof[1],hoof[2]],[hoof[0]+2.2,hoof[1],hoof[2]],'#454238',2.4);
      }
      mesh([[-17,25+bob,1,2],[-13,26+bob,5.3,6.5],[-5,27+bob,6.2,7],[6,27+bob,6.1,7],[13,27+bob,4.7,6],[16,28+bob,2.2,3]],['#9d7354','#b78c64','#c49b70','#b58b61','#8f644b','#73513e','#77533e','#8b6148']);
      // Strong arched neck, long muzzle, black mane and small alert ears.
      mesh([[10,29+bob,4,5],[14,34+bob,3.6,6],[18,40+bob,3,5],[22,42+bob,2.6,3]],['#986b4d','#bd9063','#c6a16c','#a87b52','#876045','#72503b','#81583f','#956b49']);
      mesh([[19,42+bob,2,2],[23,41+bob,3.3,4],[29,38.5+bob,2.4,2.8],[32,37.8+bob,1.6,2]],['#805d48','#ab815c','#c1a072','#a88864','#906f53','#7e614a','#7a5b45','#8c674b']);
      for(const side of [-1,1]){face([[20,side*2,43+bob],[19,side*3.1,49+bob],[23,side*2.7,44+bob]],'#9e7854');limb([21,side*2.5,44+bob],[20,side*2.8,47+bob],'#5c4f3d',1);}
      for(let i=0;i<7;i++)limb([11+i*1.5,-.4,31+i*1.7+bob],[8+i*1.6,-1.1,31+i*1.8+bob],'#3d3d32',2.1);
      const sw=Math.sin(time*2.1)*2.2;
      limb([-17,0,27+bob],[-23,sw,19+bob],'#4b4031',3.4);limb([-23,sw,19+bob],[-25,sw*1.8,10+bob],'#3d392e',3);
      // A pale blaze, reins, cheek straps, saddle blanket, leather seat and bedroll.
      face([[23,-.7,44+bob],[28,-.6,41+bob],[30,.4,39+bob],[25,.8,44+bob]],'#d7c5a0');
      for(const side of [-1,1]){
        limb([22,side*3.2,44+bob],[26,side*3.2,37+bob],'#594432',.85);limb([29,side*2.6,40+bob],[29,side*2.6,36+bob],'#58452f',.85);
        limb([27,side*3.1,38+bob],[7,side*4,31+bob],'#544936',.6);
        face([[-7,side*6.4,30+bob],[6,side*6.4,30+bob],[7,side*6.4,21+bob],[-8,side*6.4,21+bob]],'#8b5a42');
        limb([-7,side*6.5,23+bob],[6,side*6.5,23+bob],'#d0b384',1.1);
        limb([2,side*6.7,30+bob],[1,side*7,17+bob],'#6d543a',1);limb([-1,side*7,17+bob],[3,side*7,17+bob],'#aca48a',1);
        const eye=world(24,side*3.3,41.5+bob);ops.push({d:r.view.depth(...eye)+.2,fn:()=>{E.px.disc(g,...r.w(...eye),1.25*sc,'#292e27');}});
      }
      mesh([[-7,33+bob,4.3,1.7],[-3,33+bob,4.7,1.5],[4,32.6+bob,4.4,1.4],[7,34+bob,3.2,2]],['#735239','#9b7652','#b29167','#97714f','#725539','#675037','#715239','#806044']);
      limb([6,0,34+bob],[6,0,38+bob],'#876444',2);limb([-9,-4,34+bob],[-9,4,34+bob],'#859084',4.2);
      ops.sort((a,b)=>a.d-b.d);for(const op of ops)op.fn();
    },{solid:true,hides:true,box:projectedBox(r,body.x,body.y,z,80,80,58)});
  }

  function drawCowboy(r,engine,body,rig,opts={}) {
    E=engine;const lift=opts.mounted?(opts.rideZ===undefined?(rig.J&&rig.J.hipC?33-rig.worldOffset(rig.J.hipC)[2]:14):opts.rideZ):0,z=(body.z||0)+lift;
    const direct=directActors(r),height=rig.J?.head?rig.worldOffset(rig.J.head)[2]+8:44,halfWidth=Math.max(10,(rig.o.size||1)*9),bias=opts.mounted?.1:0;
    let xray=opts.xray===undefined?{color:'#d5bd8c',outline:'#f2dfb2'}:opts.xray;
    if(direct&&xray&&!needsXray(r,{x:body.x,y:body.y,z,height,halfWidth,bias,owner:body,actors:!!xray.actors}))xray=false;
    if(direct&&xray&&typeof xray==='object')xray={color:xray.color,actors:xray.actors};
    if(r.game.sceneName!=='mine'){
      const foot=r.w(body.x,body.y,z),head=r.w(body.x,body.y,z+height),hw=halfWidth*r.view.scale;
      drawnActors.push({owner:body,order:r.view.order(body.x,body.y,z)+bias,bounds:[foot[0]-hw,Math.min(foot[1],head[1])-4,foot[0]+hw,Math.max(foot[1],head[1])+4]});
    }
    if(!opts.mounted)r.shadow(body.x,body.y,9,.22,'#474839');
    r.actor(body.x,body.y,z,(g,ox,oy)=>{
      rig.draw(g,ox,oy,r.view);
      if(!rig.J||!rig.J.head)return;
      const v=rig.o.charView===false?r.view:E.charView(r.view),H=rig.J.head,R=rig.o.headR||3.2,hat=opts.hat||'#72573f';
      const P=(f,q,h)=>{const w=rig.worldOffset([H[0]+f,H[1]+q,H[2]+h]),p=v.p(...w);return [ox+p[0],oy+p[1]];};
      // The broad curled brim and pinched crown keep the cowboy silhouette at every angle.
      const brim=[];for(let i=0;i<14;i++){const a=i/14*TAU;brim.push(P(Math.cos(a)*R*1.95,Math.sin(a)*R*1.75,R*.6+Math.pow(Math.sin(a),4)*R*.17));}
      E.px.poly(g,brim,'#4f4434');
      const upper=[];for(let i=0;i<14;i++){const a=i/14*TAU;upper.push(P(Math.cos(a)*R*1.85,Math.sin(a)*R*1.62,R*.75+Math.pow(Math.sin(a),4)*R*.16));}E.px.poly(g,upper,hat);
      const crown=[P(-R*.82,-R*.65,R*.7),P(R*.8,-R*.68,R*.7),P(R*.73,-R*.56,R*1.83),P(-R*.67,-R*.55,R*1.83)];E.px.poly(g,crown,'#8d7050');
      E.px.poly(g,[P(-R*.82,R*.65,R*.7),P(R*.8,R*.68,R*.7),P(R*.73,R*.56,R*1.83),P(-R*.67,R*.55,R*1.83)],hat);
      E.px.poly(g,[P(-R*.67,-R*.55,R*1.83),P(R*.73,-R*.56,R*1.83),P(R*.73,R*.56,R*1.83),P(-R*.67,R*.55,R*1.83)],'#a18460');
      E.px.line(g,...P(-R*.55,0,R*1.86),...P(R*.5,0,R*1.86),'#66513b',Math.max(1,v.scale*.7));
      E.px.line(g,...P(-R*.85,R*.66,R*.87),...P(R*.8,R*.69,R*.87),'#433c2e',Math.max(1,v.scale*.85));
    },{xray,flash:opts.flash,flashMix:opts.flashMix,alpha:opts.alpha,bias:opts.mounted?.1:0,outline:direct?false:opts.outline,rim:direct?false:opts.rim,ghost:opts.ghost,every:opts.every,key:opts.key});
  }
  globalThis.WesternWorld={build,draw,drawHorse,drawCowboy,needsXray};
})();
