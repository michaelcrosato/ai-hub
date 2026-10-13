/* The Ninth Relay: hand-authored level. One tile = 16 world units. */
(function(root){
 'use strict';
 const W=48,H=40,T=16;
 const at=(x,y)=>({x:(x+.5)*T,y:(y+.5)*T,z:0});
 function build(E){
  const cells=Array(W*H).fill(0),floor=Array(W*H).fill('water'),blocked=new Uint8Array(W*H).fill(1);
  const carve=(x0,y0,x1,y1,tag='street')=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){floor[y*W+x]=tag;blocked[y*W+x]=0;cells[y*W+x]=0;}};
  const wall=(x0,y0,x1,y1,id=1)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)cells[y*W+x]=id;};
  const room=(x0,y0,x1,y1)=>{carve(x0,y0,x1,y1,'interior');wall(x0,y0,x1,y0);wall(x0,y1,x1,y1);wall(x0,y0,x0,y1);wall(x1,y0,x1,y1);};
  carve(3,29,19,37,'dock');carve(4,3,9,31,'metal');carve(4,3,41,5,'metal');
  carve(7,20,17,31,'market');carve(15,25,23,31,'street');carve(18,20,43,33,'yard');
  carve(9,14,18,16,'metal');room(18,6,42,20);room(33,8,41,16);
  wall(20,10,20,12,2);wall(24,10,25,10,2);wall(28,16,28,18,2);
  wall(22,24,23,25,2);wall(27,28,29,28,2);wall(35,27,37,28,2);wall(39,22,40,23,2);
  wall(12,23,13,23,2);wall(10,28,11,28,2);wall(6,20,6,21,2);
  wall(19,32,25,33,4);wall(41,29,43,31,4);
  wall(2,30,2,37,6);wall(3,38,19,38,6);wall(43,6,44,16,5);wall(19,1,24,2,5);
  const doors={front:[[30,20],[31,20]],service:[[18,15]],vault:[[33,12]],vent:[[36,6],[36,8]]};
  Object.values(doors).flat().forEach(([x,y])=>{cells[y*W+x]=3;blocked[y*W+x]=0;});
  const map=new E.TileMap({w:W,h:H,cells,shimmer:false,ao:4,types:{
   1:{h:42,top:'#243f50',side:'#132738',line:'#355062',face:'none',roof:'slab',cut:true,cutH:8},
   2:{h:19,top:'#435d69',side:'#233b4b',face:'none',roof:'slab',cut:false},
   3:{h:36,top:'#a0d7c4',side:'#267568',face:'none',roof:'plain',cut:true,cutH:17},
   4:{h:40,top:'#2c465a',side:'#1a3246',face:'plank',roof:'plain',cut:false},
   5:{h:112,top:'#132639',side:'#0d1d30',face:'none',roof:'slab',cut:false},
   6:{h:8,top:'#47606c',side:'#183747',face:'none',roof:'plain',cut:false}
  },floorTex(x,y,tag){
   const n=Math.floor(E.hash2(Math.floor(x),Math.floor(y))*7),xx=x%16,yy=y%16;
   if(tag==='water'){const band=Math.sin(x*.023+y*.013)*3;return [5+n*.35,15+n*.5+band,25+n*.7+band];}
   if(tag==='metal'){if(xx<1||yy<1)return[49,76,86];const grate=Math.floor(x)%4===0;return grate?[16,32,43]:[30+n,48+n,61+n];}
   if(tag==='interior'){if(xx<.65||yy<.65)return[45,61,72];const stripe=Math.floor(x/16)%6===0&&xx<2;return stripe?[53,106,102]:[27+n,42+n,56+n];}
   if(tag==='dock'){const seam=Math.floor(x)%8===0;return seam?[15,30,40]:[35+n,50+n,63+n];}
   let c=tag==='market'?[28+n,39+n,48+n]:[34+n,45+n,55+n];
   if((xx<.55||yy<.55)&&E.hash2(Math.floor(x/16),Math.floor(y/16))>.25)c=[23,35,46];
   if(tag==='yard'&&((Math.abs(x-500)<1.4&&y>342&&y<520)||(y>491&&y<493&&Math.floor(x/14)%2===0)))c=[126,131,69];
   if(E.noise2(x/45,y/45)>.65&&Math.floor(y)%3!==0)c=[17+n,37+n,48+n];
   return c;
  }});map.floorTags=floor;map.blocked=blocked;
  const objects=[
   {id:'contact',kind:'contact',name:'Mara / district intercom',desc:'Receive the contract.',...at(10,33),type:'console',color:'#dfff6e'},
   {id:'junction',kind:'junction',name:'Service junction',desc:'Open the service door. No RAM needed.',...at(11,15),type:'transformer'},
   {id:'front',kind:'door',name:'Freight gate',desc:'Force the gate. This alerts nearby guards.',...at(30,21),type:'console'},
   {id:'service',kind:'door',name:'Service door',desc:'Use the junction on the west walkway.',...at(17,15),type:'console'},
   {id:'vent',kind:'vent',name:'Maintenance duct',desc:'Crouch, then enter the archive through the duct.',...at(36,5),type:'vent',color:'#68f0d0'},
   {id:'security',kind:'security',name:'Security console',desc:'Open the archive door and disable cameras.',...at(26,17),type:'console'},
   {id:'core',kind:'core',name:'Memory archive',desc:'Recover the district archive.',...at(38,10),type:'pylon',scale:1.05,color:'#dfff6e'},
   {id:'extract',kind:'extract',name:'Extraction skiff',desc:'Return here with the archive.',...at(6,35),type:'console',color:'#dfff6e'},
   {id:'upgrade',kind:'upgrade',name:'Unlicensed implant bench',desc:'Install one field upgrade.',...at(16,27),type:'console',color:'#ffb56c'},
   {id:'shard1',kind:'shard',name:'Tenant message',desc:'Read the memory fragment.',...at(9,24),type:'console',scale:.55,color:'#a7b7ff',text:'TENANT 04 / PAYMENT FAILED\nI missed one payment. They locked every recording of my son. They call it a storage fee. I call it theft.'},
   {id:'shard2',kind:'shard',name:'Maintenance note',desc:'Read the memory fragment.',...at(14,4),type:'console',scale:.55,color:'#a7b7ff',text:'SHIFT 09 / SERVICE ACCESS\nThe north duct still leads to the archive. Crouch at its green grille. The camera network cannot see into the duct.'},
   {id:'shard3',kind:'shard',name:'Internal order',desc:'Read the memory fragment.',...at(22,8),type:'console',scale:.55,color:'#a7b7ff',text:'ORISON / RETENTION ORDER\nKeep the names attached to the archive. Any public release will identify every resident. The archive is collateral. Their consent is not required.'},
   {id:'battery',kind:'battery',name:'Grid transformer',desc:'Overload: stun nearby guards and disable yard cameras.',...at(33,25),type:'transformer'}
  ];
  const guardSpecs=[
   {id:'g1',name:'Gate sentry',patrol:[[24,24],[28,24],[28,26],[24,26]],hp:66},
   {id:'g2',name:'Freight patrol',patrol:[[38,25],[40,25],[40,29],[38,29]],hp:66},
   {id:'g3',name:'Service patrol',patrol:[[7,12],[7,7],[11,4],[7,7]],hp:60},
   {id:'g4',name:'Relay sentry',patrol:[[23,14],[28,14],[27,17],[23,17]],hp:66},
   {id:'g5',name:'Network officer',patrol:[[30,9],[23,9],[23,7],[30,7]],hp:78},
   {id:'g6',name:'Archive warden',patrol:[[38,13],[35,13],[35,10],[38,13]],hp:96,elite:true}
  ];
  const cameras=[{id:'cam1',kind:'camera',name:'Yard camera',desc:'Camera / 140° sweep',...at(31,22),facing:Math.PI/2,base:Math.PI/2,type:'camera',hostile:true,hp:36,r:5},
   {id:'cam2',kind:'camera',name:'Relay camera',desc:'Camera / archive approach',...at(26,7),facing:Math.PI/2,base:Math.PI/2,type:'camera',hostile:true,hp:36,r:5}];
  const decor=[];const prop=(type,x,y,opts={})=>decor.push({type,...at(x,y),...opts});
  prop('sign',11,30,{label:'LOW TIDE',color:'#ffb56c',width:56});prop('sign',30,20,{label:'NINTH RELAY',width:63,z:36,color:'#dfff6e'});
  prop('sign',43,9,{label:'ORISON',sublabel:'MEMORY IS PROPERTY',width:70,z:85,color:'#68f0d0'});
  prop('dish',44,15,{scale:1.7,z:90});prop('antenna',20,2,{scale:1.5,z:105});
  prop('pylon',40,4,{scale:1.25});prop('antenna',4,4,{scale:.8});prop('pylon',4,30,{scale:.65,color:'#ffa06c'});
  for(let y=9;y<=15;y+=2){prop('server',40,y,{light:y===11,orientation:1});prop('server',34,y,{light:false});}
  for(let x=20;x<=28;x+=2){prop('server',x,7,{scale:.8,light:x===24});}
  prop('transformer',7,19,{orientation:1,light:false});prop('vent',19,19,{scale:1.1});prop('vent',41,18,{scale:1.3});
  for(const [x,y]of [[22,24],[23,25],[27,28],[29,28],[35,27],[37,28],[39,22],[40,23],[12,23],[13,23],[10,28]])prop('crate',x,y,{z:19,scale:.6,light:false});
  for(let x=4;x<=18;x+=3)prop('bollard',x,37,{color:x%2?'#ffb66a':'#68f0d0'});
  for(let y=7;y<=28;y+=5)prop('bollard',4,y,{scale:.6,color:'#68f0d0'});
  prop('sign',15,22,{label:'REPAIR / NO QUESTIONS',width:58,scale:.8,color:'#ffb56c'});
  prop('vent',25,32,{z:40,scale:1.4});prop('antenna',42,30,{z:40,scale:.7});
  prop('drone',16,35,{color:'#a7cbd9',light:false,phase:2});
  const civilians=[{...at(10,25),name:'Resident',facing:.5,pose:'hips',color:'#8c6076'},
    {...at(15,28),name:'Mechanic',facing:2,pose:'kneel',color:'#be8656'},
    {...at(13,32),name:'Dock worker',facing:4,pose:null,color:'#597d7d'}];
  return{map,objects,guardSpecs,cameras,decor,civilians,doors,spawn:at(9,35),at,W,H,T};
 }
 root.VeilLevel={build,W,H,T,at};
})(typeof window==='undefined'?globalThis:window);
