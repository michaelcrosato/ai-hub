/* Original world art and map construction. Uses only public my-3D2dge APIs. */
(() => {
'use strict';
const D = globalThis.Dawn = globalThis.Dawn || {}, E = My3D2dge;
const PALETTES = {
  bell642:{grass:'#4f755d',deep:'#23483f',light:'#729071',path:'#b8a080',water:'#396c7a',wall:'#a9a58a',roof:'#926752',sky:['#658d8b','#c4b39a'],flora:'#49785a',edge:'#284c44'},
  seed112:{grass:'#426c56',deep:'#204b40',light:'#67975f',path:'#988866',water:'#3c9291',wall:'#879373',roof:'#496349',sky:['#3a6968','#b3c6a3'],flora:'#477e55',edge:'#315241'},
  glass1186:{grass:'#4d686d',deep:'#2b4d57',light:'#7a9095',path:'#a5b7b4',water:'#4b929c',wall:'#a9b6b8',roof:'#697da3',sky:['#425c7c','#afb2c4'],flora:'#6b927f',edge:'#466175'},
  ash2310:{grass:'#655f63',deep:'#3c414b',light:'#8c8080',path:'#99918c',water:'#4b6468',wall:'#8b8580',roof:'#596879',sky:['#343f50','#a78879'],flora:'#506362',edge:'#41444e'},
  fold:{grass:'#426365',deep:'#1d3947',light:'#698983',path:'#88a39b',water:'#325a75',wall:'#708c9c',roof:'#69769c',sky:['#172e45','#697884'],flora:'#66998c',edge:'#354b63'}
};
D.palette = era => PALETTES[era] || PALETTES.bell642;
const heroLooks = {
  mira:{weapon:'sword',outfit:'coat',hair:'ponytail',colors:{skin:'#d9ae90',hair:'#714334',cloth:'#9b5345',coat:'#af6350',pants:'#385b61',boot:'#2b383c',trim:'#ebc77f',cape:'#813f39',metal:'#d4e3cf'}},
  soren:{weapon:'staff',outfit:'robe',hair:'short',colors:{skin:'#bb8e72',hair:'#c3bea1',cloth:'#577c85',coat:'#698f91',pants:'#314f68',boot:'#293c4a',trim:'#d6c48f',metal:'#adbfba'}},
  brann:{weapon:'sword',build:'bulky',armor:true,outfit:'tunic',hair:'short',colors:{skin:'#bd8662',hair:'#57382c',cloth:'#9d6243',pants:'#524741',boot:'#3b3530',trim:'#d8a562',plate:'#77867b',metal:'#abbbab'}},
  ilex:{weapon:'staff',outfit:'robe',hair:'long',colors:{skin:'#99ad76',hair:'#506a40',cloth:'#647d4e',pants:'#43583e',boot:'#484c37',trim:'#d1c38b',metal:'#a9c88d'}},
  nyx:{weapon:'sword',outfit:'robe',hair:'long',colors:{skin:'#c2a6a1',hair:'#283342',cloth:'#836d9e',pants:'#354158',boot:'#343044',trim:'#d1bba3',metal:'#e0dce7'},cape:{len:5,width:5,seg:2}},
  vale:{weapon:'gun',outfit:'coat',hair:'spiky',colors:{skin:'#c49375',hair:'#cdc2a6',cloth:'#668e89',coat:'#599693',pants:'#36475a',boot:'#26353c',trim:'#d2b473',metal:'#b7c4bc'}}
};
D.makeRig = (id, overrides = {}) => new E.Humanoid(Object.assign({size:1.1,build:'chibi',sleeves:'long',face:{eyes:'big',bangs:.55}},heroLooks[id] || heroLooks.soren,overrides));
D.makeNpcRig = (person,era) => {
  if(heroLooks[person.hero||person.character])return D.makeRig(person.hero||person.character,{size:1.02,weapon:null});
  const seed=[...person.id].reduce((v,c)=>(v*31+c.charCodeAt(0))>>>0,17),pick=values=>values[seed%values.length];
  const cloth=pick({bell642:['#b57b55','#61898b','#90955b','#a8625b'],seed112:['#81935b','#9e8462','#4d897c','#b5915c'],glass1186:['#7e83a2','#62a7ab','#ab887c','#818f72'],ash2310:['#a18262','#768f8d','#956966','#8d9276'],fold:['#8d8fac','#799f98','#b49971','#807c9b']}[era]||['#768f8d']);
  return new E.Humanoid({size:seed%3===0?1.05:.96,build:seed%7===0?'bulky':'chibi',outfit:pick(['tunic','coat','robe']),weapon:null,sleeves:'long',hair:['short','ponytail','long','bald'][Math.floor(seed/5)%4],face:{eyes:'big',bangs:.35},colors:{skin:['#d7b392','#b58269','#8e6754','#d7a783'][Math.floor(seed/7)%4],hair:['#533d32','#343d43','#acaa98','#925c3d'][Math.floor(seed/11)%4],cloth,coat:cloth,pants:'#3c535a',boot:'#2c3b42',trim:'#d7bd87',metal:'#b5c6bb'}});
};
D.makeEnemyRig = def => {
  const hearth=D.makeHearthRig?.(def);if(hearth)return hearth;
  const appearance=def.rigId?{...def,id:def.rigId}:def;
  const special=D.makeSpecialRig?.(appearance);if(special){special.height*=appearance.size||1;return special;}
  const name=appearance.id||appearance.name||'';
  const hue = appearance.color || D.enemyColor?.(appearance) || (/ember|furnace|kiln|fire/.test(name)?'#be7650':/ink|mask|echo|witness|orin/.test(name)?'#9175aa':/glass|archive|index/.test(name)?'#86adc0':/scrap|drone|relay|walker/.test(name)?'#a69d81':/moth|wisp|ray/.test(name)?'#b0bea0':/bell|warden/.test(name)?'#b2a16b':'#689485');
  if (appearance.rig==='humanoid' || /guard|warden|regent|keeper|orin|witness|sentinel|knight|archivist/i.test(name)) return new E.Humanoid({size:def.boss?1.6:1.15,build:def.boss?'bulky':'heroic',weapon:def.boss?'staff':'sword',outfit:'robe',hair:'bald',hat:def.boss?'crown':'helmet',armor:true,colors:{skin:E.shade(hue,.2),cloth:hue,metal:'#bbc0ac',plate:E.shade(hue,-.25),trim:'#d7bc85',pants:'#374452',boot:'#24313b'},eyeGlow:true});
  return new E.Blob({R:def.boss?21:10,colors:{dk:E.shade(hue,-.5),base:hue,lt:E.shade(hue,.2),spec:'#dfe1bc',eye:'#e9e0bf',pupil:'#162c35'},ears:/hare|moth|hareling/.test(name)?'rabbit':null,horns:!!def.boss||/crab|beetle|hart|hound/.test(name),wings:/moth|wisp|drone|bird|ray/.test(name),feet:true,tail:/hound|lizard|crab/.test(name),mouth:'fangs'});
};

class World {
  constructor(zone, flags = {}) {
    this.zone=zone; this.flags=flags; this.artKit=zone.hearthTheme?D.HearthArt:zone.dungeonId?D.DungeonArt:null;this.palette=Object.assign({},D.palette(zone.era),this.artKit?.palette(zone,flags)||{}); this.props=[]; this.rigs=new Map();
    this.entities=(zone.entities||[]).map(o=>Object.assign({},o,{tx0:o.x,ty0:o.y,x:(o.x+.5)*16,y:(o.y+.5)*16,z:0,r:7}));
    const exits=[...(zone.exits||[])];if(zone.worldPosition&&!zone.overworldParent&&!exits.some(e=>e.to===zone.worldPosition.zone))exits.push({id:zone.id+'_overworld',to:zone.worldPosition.zone,name:'The open road',x:15,y:21});
    this.exits=exits.map(o=>Object.assign({},o,{type:'exit',tx0:o.x,ty0:o.y,x:(o.x+.5)*16,y:(o.y+.5)*16,z:0,r:9}));
    const P=this.palette, rgb={}; for(const k of ['grass','deep','light','path','water','edge'])rgb[k]=E.hex(P[k]);
    const paths=['path','bridge','stone','planks'],authoredFloor=this.artKit?.floorPainter(zone,P),structured=!!this.artKit;
    this.map=new E.TileMap({w:zone.width||32,h:zone.height||24,types:{1:{h:P.wallHeight||24,top:P.edge,side:P.deep,face:P.wallFace||'rock',roof:P.wallRoof||(structured?'slab':'grass'),cut:true,cutH:7},2:{h:37,top:P.roof,side:P.wall,face:zone.era==='bell642'?'timber':'stone',roof:'tiles',beam:P.deep,cut:structured,cutH:9},3:{h:19,top:P.wall,side:P.edge,face:P.wallFace||'stone',roof:'slab',cut:true}},ao:3,floorTex:(x,y,tag)=>{
      if(authoredFloor)return authoredFloor(x,y,tag);
      let c=rgb.grass,n=E.hash2(x,y),patch=E.hash2(Math.floor(x/5),Math.floor(y/5));
      if(tag==='water') { const wave=E.hash2(Math.floor(x/6),Math.floor(y/2)); return rgb.water.map((v,i)=>E.clamp(v+(wave>.82?18:wave<.2?-8:0),0,255)); }
      if(tag==='sand')return rgb.path.map((v,i)=>E.clamp(v+(i===2?-4:12)+(n>.88?8:n<.1?-9:0),0,255));
      if(tag==='soil')return rgb.path.map(v=>E.clamp(v*.7+(Math.floor(y)%6===0?-14:n>.9?8:0),0,255));
      if(tag==='metal')return rgb.path.map(v=>E.clamp(v*.83+(Math.floor(x)%16===0||Math.floor(y)%16===0?-22:n>.94?11:0),0,255));
      if(paths.includes(tag)){const seam=(Math.floor(y)%9===0||((Math.floor(x)+(Math.floor(y/9)%2)*8)%17===0));c=rgb.path;return c.map(v=>Math.max(0,v+(seam?-16:n>.91?10:n<.15?-7:0)));}
      const s=patch<.25?-8:patch>.76?7:0;return c.map((v,i)=>E.clamp(v+s+(n>.94?(i===1?17:8):n<.075?-12:0),0,255));
    }});
    this.build();
    D.SmallHoursArt?.decorate(this);
    if((this.artKit||this.smallHoursDecorated)&&D.DungeonArt)D.DungeonArt.cacheFloor(this);
    this.flow=new E.FlowField(this.map);
    this.backdrop=new E.Backdrop({sky:P.sky,layers:[{kind:'clouds',color:E.mix(P.sky[0],'#ffffff',.22),y:.3,height:.16,parallax:.1},{kind:'mountains',color:P.edge,y:.45,height:.2,parallax:.2}]});
  }
  build(){
    const m=this.map,Z=this.zone,P=this.palette;
    const W=m.w,H=m.h;m.fill(0,0,W,1,1);m.fill(0,H-1,W,1,1);m.fill(0,0,1,H,1);m.fill(W-1,0,1,H,1);
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)m.setFloor(x,y,'grass',false);
    const fRect=(x,y,w,h,tag,blocked=false)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(xx>0&&xx<W-1&&yy>0&&yy<H-1)m.setFloor(xx,yy,tag,blocked);};
    this.rect=fRect;
    if(this.artKit)this.artKit.build(this,fRect);
    else if(Z.layout)this.buildLayout(fRect);
    else{
    fRect(3,11,26,3,'path');fRect(14,3,3,18,'path');
    if(/town|village|quay|camp/.test(Z.style)||Z.id==='bell_quay'){
      for(const [x,y,w,h]of [[5,4,5,4],[22,4,5,4],[4,17,5,3],[22,17,5,3]]){m.fill(x,y,w,h,2);this.addProp('door',(x+Math.floor(w/2)+.5)*16,(y+h+.15)*16,{size:1.25});this.addProp('lantern',(x+w+.4)*16,(y+h)*16,{light:true});}
      this.addProp('awning',200,130,{color:'#b8885c',size:1.5});this.addProp('barrel',69,172,{});this.addProp('crate',81,165,{});
    }else if(/archive|tower|observatory|vault|foundry|cistern|gallery|heart|crown/.test(Z.style+' '+Z.id)){
      for(const [x,y]of [[5,5],[25,5],[5,18],[25,18]]){m.fill(x,y,2,2,3);this.addProp(Z.era==='ash2310'?'firedrum':'pillar',(x+1)*16,(y+1)*16,{size:1.45,color:P.wall,light:Z.era==='ash2310'});}
      fRect(9,7,14,11,'stone');
      for(let x=8;x<27;x+=5)this.addProp('crystal',x*16,55,{color:P.water,size:.8});
    }else{
      fRect(2,3,3,17,'water',true);fRect(2,10,7,3,'bridge',false);
      for(const [x,y]of [[7,4],[25,4],[8,17],[27,17]])this.addProp('tree',(x+.5)*16,(y+.5)*16,{color:P.flora,size:1.4});
    }
    }
    for(const f of Z.features||[]){
      if(f.requires?.flags&&!f.requires.flags.every(id=>this.flags[id]))continue;
      if(f.requires?.notFlags&&f.requires.notFlags.some(id=>this.flags[id]))continue;
      const x=Math.round(f.x),y=Math.round(f.y),w=Math.max(1,f.w||1),h=Math.max(1,f.h||1),kind=f.kind;
      if(['wall','house'].includes(kind))m.fill(x,y,w,h,kind==='house'?2:3);
      else if(['water','pool','river'].includes(kind))fRect(x,y,w,h,'water',true);
      else if(['path','bridge'].includes(kind))fRect(x,y,w,h,kind,false);
      else {
        const prop={trees:'tree',garden:'flowers',ruins:'rock',pillars:'pillar',crystals:'crystal'}[kind]||kind;
        for(let iy=0;iy<h;iy+=2)for(let ix=0;ix<w;ix+=2)this.addProp(prop,(x+ix+.5)*16,(y+iy+.5)*16,{size:f.size||1,color:f.color||P.flora});
      }
    }
    const spawn=Z.spawn||{x:15,y:12};
    // New layouts keep their roads and rooms. Only an unreachable interaction gets a short connecting path.
    if(Z.dungeonId||Z.hearthTheme){
      // These barriers and paths are authored. Never repair a route through them.
    }else if(Z.layout)this.connectLayout(spawn);
    else for(const obj of [{tx0:spawn.x,ty0:spawn.y},...this.entities,...this.exits]){
      if(obj.preserveLayout)continue;
      const tx=Math.round(obj.tx0),ty=Math.round(obj.ty0); if(!Number.isFinite(tx)||!Number.isFinite(ty))continue;
      const clear=(cx,cy)=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){let px=cx+a,py=cy+b;if(px>0&&px<31&&py>0&&py<23){m.set(px,py,0);m.setFloor(px,py,'path',false);}}};
      let cx=Math.round(spawn.x),cy=Math.round(spawn.y);clear(cx,cy);
      while(cx!==tx){cx+=Math.sign(tx-cx);clear(cx,cy);}while(cy!==ty){cy+=Math.sign(ty-cy);clear(cx,cy);}
    }
    for(let i=0;i<(this.artKit?0:95);i++){
      const x=2+Math.floor(E.hash2(i+17,Z.id.length)*28),y=2+Math.floor(E.hash2(i+43,Z.id.charCodeAt(0))*20);
      if(m.cell(x,y)!==0||m.floorAt(x*16+8,y*16+8)!=='grass')continue;
      const near=this.entities.some(e=>Math.hypot(e.x-x*16-8,e.y-y*16-8)<26);if(near)continue;
      const lush=Z.era==='seed112'||Z.era==='bell642'||(Z.era==='ash2310'&&(this.flags.future_bridge||this.flags.root_planted));
      const names=lush?['grass','flowers','bush','rock','mushroom']:['rock','bones','crystal','grass'];
      this.addProp(names[i%names.length],x*16+8,y*16+8,{size:.6+E.hash2(x,y)*.6,color:i%4===1?'#d6b88d':P.flora});
    }
    if(!this.artKit&&Z.id.includes('orchard')){
      for(const [x,y]of [[7,5],[23,6],[7,18],[24,19]])this.addProp('tree',(x+.5)*16,(y+.5)*16,{size:1.7,color:this.flags.seed_key?'#77a06d':'#647e5b'});
      this.addProp('flowers',260,155,{size:1.6,color:'#e1b686'});
    }
    if(!this.artKit&&Z.era==='ash2310'&&(this.flags.future_bridge||this.flags.bridge_seed))for(let i=0;i<15;i++)this.addProp('bush',65+i*24,92+Math.sin(i)*14,{color:'#6d9a66',size:1});
  }
  buildLayout(rect){
    const m=this.map,Z=this.zone,P=this.palette,prop=(name,x,y,o={})=>this.addProp(name,(x+.5)*16,(y+.5)*16,o);
    const house=(x,y,w,h)=>{m.fill(x,y,w,h,2);prop('door',x+Math.floor(w/2),y+h,{size:1.1});prop('lantern',x+w,y+h,{light:true});};
    const path=(x,y,w,h)=>rect(x,y,w,h,'path'),stone=(x,y,w,h)=>rect(x,y,w,h,'stone');
    switch(Z.layout){
    case 'harbor':
      rect(1,1,30,22,'sand');rect(1,14,30,9,'water',true);stone(2,9,28,5);
      for(const x of [5,14,24]){rect(x,12,3,10,'planks');prop('barrel',x,13);prop('lantern',x+1,20,{light:true});}
      house(4,3,6,4);house(22,3,5,4);path(13,3,5,10);prop('awning',12,8,{color:P.roof,size:1.8});
      prop('boatHull',9,18,{color:Z.era==='ash2310'?'#748d96':'#aa784d'});prop('boatHull',21,17,{color:'#698984'});break;
    case 'workshop':
      stone(2,2,28,20);rect(8,8,16,9,'metal');house(3,3,6,4);house(23,3,5,4);
      for(const [x,y]of [[5,11],[26,11],[6,17],[25,17]]){prop('crate',x,y,{size:1.4});prop('barrel',x+1,y+1);prop('lantern',x,y-2,{light:true});}
      prop(Z.id.includes('shipyard')?'boatHull':Z.id.includes('hangar')?'airshipHull':'loom',16,7,{color:P.roof,size:1.2});path(13,18,6,4);break;
    case 'ridge':
      rect(1,1,30,22,'sand');for(const [x,y,w,h]of [[2,3,9,4],[17,2,12,5],[3,14,7,6],[23,14,6,6]])m.fill(x,y,w,h,1);
      path(10,7,16,3);path(10,8,3,9);path(10,15,12,3);path(19,15,3,6);path(11,19,10,3);
      for(const [x,y]of [[4,10],[7,12],[27,11],[18,5],[25,19]])prop('rock',x,y,{size:1.8,color:P.wall});prop('sign',14,11);break;
    case 'grove':
      rect(2,3,3,17,'water',true);rect(2,11,8,2,'bridge');path(8,10,17,3);path(14,4,3,17);
      for(const [x,y]of [[8,4],[11,5],[23,4],[26,7],[6,17],[10,20],[25,17],[28,19]]){prop('tree',x,y,{size:1.8,color:P.flora});prop('flowers',x-1,y+1,{color:'#dbc392'});}
      rect(11,8,10,7,'soil');prop('crystal',18,6,{color:'#b3dec7',size:1.4});break;
    case 'canals':
      stone(1,1,30,22);for(const x of [5,14,24])rect(x,2,3,20,'water',true);
      for(const y of [7,16])rect(3,y,26,2,'bridge');house(9,2,4,4);house(18,10,5,4);house(8,18,5,3);
      for(const [x,y]of [[3,7],[12,16],[23,7],[28,16]])prop('lantern',x,y,{light:true});prop('boatHull',15,11,{color:'#92bec0'});break;
    case 'ruin':
      stone(3,3,26,18);m.fill(5,4,22,2,3);m.fill(5,18,22,2,3);m.fill(5,6,2,12,3);m.fill(25,6,2,12,3);
      for(const [x,y]of [[5,11],[25,11],[14,4],[14,18]]){m.fill(x,y,3,2,0);path(x,y,3,2);}
      rect(11,8,10,7,'metal');for(const [x,y]of [[9,7],[22,7],[9,16],[22,16]])prop('pillar',x,y,{size:1.4,color:P.wall});
      prop('crystal',16,5,{size:1.5,color:'#c3b6d5'});break;
    case 'mine':
      stone(1,1,30,22);for(const [x,y,w,h]of [[2,2,10,5],[18,2,11,5],[2,10,7,6],[23,10,6,6],[10,17,12,4]])m.fill(x,y,w,h,1);
      path(11,3,7,5);path(8,7,16,3);path(9,8,3,11);path(10,14,14,3);path(21,15,3,7);path(12,21,12,1);
      for(const [x,y]of [[4,8],[27,8],[7,17],[25,18],[14,4]]){prop('crystal',x,y,{color:'#e4ba6a',size:1.3});prop('rock',x+1,y+1,{color:P.wall});}break;
    case 'garden':
      path(4,5,24,2);path(4,18,24,2);path(4,5,2,14);path(26,5,2,14);path(14,3,3,19);path(4,11,24,3);
      for(const [x,y]of [[8,8],[20,8],[8,15],[20,15]]){rect(x,y,4,2,'soil');for(let i=0;i<4;i++)prop('flowers',x+i,y+.5,{size:1.1,color:Z.era==='glass1186'?'#bcb7df':'#dfc487'});}
      prop('pillar',16,6,{size:.7,color:P.wall});prop('crystal',16,5,{size:1.2,color:'#b4d9be'});prop('tree',5,3,{size:1.6});prop('tree',27,3,{size:1.6});break;
    case 'camp':
      rect(2,15,6,6,'water',true);path(4,10,24,3);path(14,3,3,19);path(7,19,20,3);
      for(const [x,y]of [[6,6],[23,5],[25,17]]){prop('awning',x,y,{size:1.8,color:P.roof});prop('crate',x-1,y+2);prop('barrel',x+2,y+2);}
      prop('firedrum',16,8,{size:.8,light:true});prop('tree',3,3,{size:1.5});break;
    case 'citadel':
      stone(2,2,28,20);m.fill(3,3,26,2,3);m.fill(3,18,26,2,3);m.fill(3,5,2,13,3);m.fill(27,5,2,13,3);
      for(const [x,y]of [[14,3],[14,18],[3,10],[27,10]]){m.fill(x,y,3,3,0);stone(x,y,3,3);}
      for(const [x,y]of [[9,7],[23,7],[9,16],[23,16]])prop('pillar',x,y,{size:1.65,color:P.wall});rect(10,9,13,6,'metal');
      prop('loom',16,6,{color:Z.era==='fold'?'#d6c398':'#9ecdd0'});break;
    default:path(4,10,24,4);path(14,3,3,19);break;
    }
  }
  connectLayout(spawn){
    const m=this.map,w=32,h=24,start=Math.round(spawn.y)*w+Math.round(spawn.x);
    const clear=(x,y)=>{const tag=m.floorAt(x*16+8,y*16+8)==='water'?'bridge':'path';m.set(x,y,0);m.setFloor(x,y,tag,false);};clear(Math.round(spawn.x),Math.round(spawn.y));
    for(const e of [...this.entities,...this.exits]){
      if(e.preserveLayout)continue;
      const tx=Math.round(e.tx0),ty=Math.round(e.ty0);if(tx<1||tx>=31||ty<1||ty>=23)continue;const end=ty*w+tx;
      const costs=new Float64Array(w*h).fill(Infinity),prev=new Int32Array(w*h).fill(-1),closed=new Uint8Array(w*h),open=[start];costs[start]=0;
      while(open.length){let best=0;for(let i=1;i<open.length;i++)if(costs[open[i]]<costs[open[best]])best=i;const current=open.splice(best,1)[0];if(closed[current])continue;closed[current]=1;if(current===end)break;
        const x=current%w,y=Math.floor(current/w);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||nx>=31||ny<1||ny>=23)continue;const next=ny*w+nx;if(closed[next])continue;const tag=m.floorAt(nx*16+8,ny*16+8),step=m.walkable(nx,ny)?(['path','stone','planks','bridge'].includes(tag)?.65:1.3):tag==='water'?8:24,cost=costs[current]+step;
          if(cost<costs[next]){costs[next]=cost;prev[next]=current;open.push(next);}}
      }
      for(let n=end;n!==-1&&n!==start;n=prev[n])if(!m.walkable(n%w,Math.floor(n/w)))clear(n%w,Math.floor(n/w));
    }
  }
  addProp(name,x,y,o={}){this.props.push({name,x,y,z:0,o});}
  visible(entity,app){return app.meets(entity.requires)&&! (entity.hideIf&&app.meets(entity.hideIf));}
  interactables(app){return [...this.entities,...this.exits].filter(e=>{
    if(e.type==='chest'&&app.state.opened[e.id])return false;
    if(e.type==='encounter'&&app.state.cleared[e.encounter||e.id])return false;
    // Locked exits and gates remain visible so a player can read their requirement.
    return (e.type==='exit'||e.type==='gate')?!(e.hideIf&&app.meets(e.hideIf)):this.visible(e,app);
  });}
  update(dt,app){
    for(const obj of this.entities){
      if(!this.rigs.has(obj.id)){
        if(obj.type==='npc'&&!D.SmallHoursArt?.isObject(obj))this.rigs.set(obj.id,D.makeNpcRig(D.SmallHoursArt?.person(obj)||obj,this.zone.era));
        if(obj.type==='encounter'){
          const enc=app.content.encounters[obj.encounter||obj.id],def=enc&&app.content.enemies[enc.enemies[0]];
          if(def)this.rigs.set(obj.id,D.makeEnemyRig(def));
        }
      }
      const rig=this.rigs.get(obj.id); if(!rig)continue;
      if(rig instanceof E.Humanoid)rig.update(dt,{x:obj.x,y:obj.y,z:0,facing:Math.PI/2,pose:obj.type==='npc'?'hips':undefined});
      else rig.update(dt,{look:[-1,.2],flap:.5,walk:0});
    }
  }
  draw(r,app){
    const P=this.palette,t=app.game.time;
    if(this.artKit)this.artKit.backdrop(r,this,app);else this.backdrop.draw(r);
    this.map.drawFloor(r);this.artKit?.ground(r,this,app);D.SmallHoursArt?.ground(r,this,app);this.map.queueWalls(r);
    for(const p of this.props)if(r.visible(p.x,p.y,p.z)){
      if(D.SmallHoursArt?.prop(r,p,this,app)||this.artKit?.prop(r,p,this,app)||this.artKit!==D.DungeonArt&&D.DungeonArt?.prop(r,p,this,app))continue;
      if(p.name==='boatHull')r.actor(p.x,p.y,0,(g,x,y)=>{const s=p.o.size||1;g.save();g.translate(x,y);g.scale(s,s);E.px.poly(g,[[-27,-9],[27,-9],[17,6],[-19,6]],p.o.color||'#9a704d');E.px.line(g,-23,-6,22,-6,'#d0b17a',2);E.px.line(g,0,-7,0,-34,'#665346',2);E.px.poly(g,[[2,-32],[2,-11],[20,-12]],'#e0d6b5');E.px.line(g,-12,-6,-12,3,'#594f47',1);E.px.line(g,11,-6,11,3,'#594f47',1);g.restore();});
      else if(p.name==='airshipHull'&&D.drawOverworldTraveler)D.drawOverworldTraveler(r,p.x,p.y,'airship','mira',app.game.time,0,false);
      else if(p.name==='loom')r.actor(p.x,p.y,0,(g,x,y)=>{E.px.rect(g,x-26,y-40,4,40,'#687b77');E.px.rect(g,x+22,y-40,4,40,'#687b77');E.px.rect(g,x-26,y-40,52,5,p.o.color);for(let i=0;i<9;i++)E.px.line(g,x-18+i*4,y-36,x-18+i*4,y-4,i%2?'#a6d2c2':'#d0bf8c',1);E.px.rect(g,x-25,y-8,50,4,p.o.color);});
      else r.prop(p.name,p.x,p.y,p.z,Object.assign({hides:true},p.o));
    }
    for(const e of [...this.entities,...this.exits]){
      if(e.type!=='exit'&&e.type!=='gate'&&!this.visible(e,app))continue;
      if(e.hideIf&&app.meets(e.hideIf))continue;
      if(e.type==='encounter'&&app.state.cleared[e.encounter||e.id])continue;
      if(app.battle&&e.type==='encounter'&&e.encounter===app.encounterId)continue;
      const rig=this.rigs.get(e.id),active=app.nearest&&app.nearest.id===e.id;
      if(D.SmallHoursArt?.entity(r,e,this,app)){
        // Quest scenery and field notes use their authored object, not a person.
      }else if(e.type==='npc'||e.type==='encounter'){
        r.shadow(e.x,e.y,e.type==='npc'?7:12,.3);
        if(rig)r.actor(e.x,e.y,0,(g,ox,oy)=>rig.draw(g,ox,oy,r.view),e.type==='npc'?{xray:{color:P.light,outline:'#e1d5af'}}:{});
        const isBoss=e.type==='encounter'&&app.content.encounters[e.encounter||e.id]?.boss;
        if(!D.SmallHoursArt&&(isBoss||active))r.textAt(e.x,e.y,isBoss?(this.rigs.get(e.id)?.height||54):42,isBoss?'*':e.type==='npc'?'!':'*',isBoss?'#f0b26e':'#f0ddab');
      }else if(e.type==='gate'){
        const ok=app.meets(e.requires);if(D.Art)D.Art.drawGate(r,e.x,e.y,0,t,ok?'#99e4d0':'#6c858a');
      }else if(e.type==='chest')r.prop('chest',e.x,e.y,0,{open:!!app.state.opened[e.id],size:1.1,color:'#bc945c'});
      else if(e.type==='shrine'){
        r.prop('crystal',e.x,e.y,0,{size:1.3,color:'#99d6bd'});r.prop('flowers',e.x+13,e.y+5,0,{color:'#d7c08c'});
        r.decal(g=>r.groundRing(e.x,e.y,18,'#adcda1',.3));
      }else if(e.type==='exit'){
        r.prop('sign',e.x,e.y,0,{size:1.1,color:P.path});
        if(active)r.textAt(e.x,e.y,28,app.content.zones.find(z=>z.id===e.to)?.name||'Path','#edddb4');
      }else if(this.artKit?.entity(r,e,this,app)||this.artKit!==D.DungeonArt&&D.DungeonArt?.entity(r,e,this,app)){
        // The room theme supplies a clear apparatus for field interactions.
      }else if(e.type==='puzzle'||e.type==='switch'){
        r.prop('pillar',e.x,e.y,0,{size:.55,color:'#98a687'});r.prop('crystal',e.x,e.y,18,{size:.6,color:'#c0cda1'});
      }else if(e.type==='bed'||e.type==='plant')r.prop('flowers',e.x,e.y,0,{size:1.2,color:'#d0b77e'});
      else if(e.type==='shop')r.prop('awning',e.x,e.y,0,{size:1.5,color:'#b4825b'});
      else if(e.type==='minigame')r.prop('candelabra',e.x,e.y,0,{size:1.4,color:'#bfaf7b'});
      else r.prop('sign',e.x,e.y,0,{size:1.05,color:P.path});
      D.SmallHoursArt?.marker(r,e,this,app);
      if(active&&e.type!=='encounter')r.decal(g=>r.groundRing(e.x,e.y,12,'#f2d99a',.55));
    }
    // Quiet era particles: falling leaves, ash, or light. They do not depend on frame rate.
    if(this.artKit)this.artKit.ambient(r,this,app);
    else r.overlay(g=>{for(let i=0;i<22;i++){const x=(E.hash2(i,12)*r.W+t*(this.zone.era==='ash2310'?3:5))%r.W;const y=(E.hash2(i,29)*r.H+t*(this.zone.era==='fold'?-2:3)+r.H*5)%r.H; if(y<r.H-56)E.px.rect(g,x,y,i%3===0?2:1,1,i%2?'#c8c79b':'#a7c7b1');}});
  }
}
D.World=World;
})();
