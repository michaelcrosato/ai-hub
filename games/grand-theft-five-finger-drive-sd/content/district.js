(() => {
const G=Drive;
G.content={schema:1,
 heatNames:['CLEAR','NOTICED','WANTED','PURSUIT','LOCKDOWN'],
 roads:{x:[240,880,1520,2160],y:[240,800,1360],halfWidth:64},
 traffic:{route:[{x:2142,y:258},{x:2142,y:1342},{x:258,y:1342},{x:258,y:258}],signals:{x:[880,1520],y:[240,800,1360],period:6},starts:[[400,258],[900,258],[1400,258],[1900,258],[2142,500],[2142,1000],[1900,1342],[1400,1342],[900,1342],[222,1100],[222,600]],patrol:[{x:2142,y:818},{x:1502,y:818},{x:1502,y:1342},{x:2142,y:1342}]},
 crew:[
  {id:'mara',name:'Mara Quinn',role:'DRIVER',color:'#f4b94f',skin:'#ba795a',hair:'#33252a',ability:'Grip Focus',description:'A clean line through a dirty city.'},
  {id:'teo',name:'Teo Banks',role:'OPERATOR',color:'#63c8bd',skin:'#a76c4d',hair:'#242b32',ability:'Circuit Cut',description:'Every gate has a bad idea inside it.'},
  {id:'kit',name:'Kit Vega',role:'PROTECTOR',color:'#ee7f8c',skin:'#e7b88a',hair:'#5b3531',ability:'Steady Nerve',description:'Keep the crew standing. Keep moving.'}
 ],
 vehicles:{
  compact:{name:'Cricket',length:38,width:20,speed:235,accel:115,grip:7,hp:120,color:'#efac64',seats:4,shape:'compact'},
  sport:{name:'Sunbeam',length:42,width:22,speed:320,accel:150,grip:6,hp:100,color:'#de6870',seats:4,shape:'sport'},
  van:{name:'Box Office',length:48,width:24,speed:205,accel:90,grip:6,hp:190,color:'#62b7af',seats:4,shape:'van'},
  taxi:{name:'Dayfare',length:44,width:22,speed:250,accel:115,grip:7,hp:130,color:'#ecc65c',seats:4,shape:'sedan'},
  police:{name:'Civic Concern',length:44,width:22,speed:270,accel:125,grip:8,hp:160,color:'#e5ded0',seats:4,shape:'sedan'},
  armored:{name:'Meter Maid',length:50,width:26,speed:195,accel:85,grip:5,hp:280,color:'#7b8790',seats:4,shape:'van'}
 },
 weapons:{
  pistol:{name:'SIDEARM',mag:12,reserve:72,rate:.32,reload:1.2,damage:22,range:240,spread:.025,pellets:1},
  auto:{name:'BURST SMG',mag:24,reserve:120,rate:.095,reload:1.65,damage:11,range:210,spread:.09,pellets:1},
  shotgun:{name:'SCATTERGUN',mag:6,reserve:36,rate:.85,reload:1.8,damage:12,range:135,spread:.23,pellets:6}
 },
 places:[
  {id:'garage',name:'MARIGOLD GARAGE',sub:'Good people. Questionable invoices.',x:350,y:365},
  {id:'boardwalk',name:'BOARDWALK AVENUE',sub:'Sun, sea, and a service charge.',x:620,y:240},
  {id:'valet',name:'VALET COURT',sub:'Your next car is waiting.',x:690,y:440},
  {id:'depot',name:'METERMINT DEPOT',sub:'The city charges back.',x:1760,y:620},
  {id:'canal',name:'CANAL ROAD',sub:'Keep your wheels out of the water.',x:880,y:1120},
  {id:'market',name:'MARKET LOOP',sub:'Everything must go. Including you.',x:1520,y:1200},
  {id:'pier',name:'BROADCAST PIER',sub:'Public air. Private problems.',x:2120,y:1630}
 ],
 points:{survey:{x:1520,y:240,zone:'city'},brief:{x:352,y:370,zone:'city'},valet:{x:690,y:440,zone:'city'},staging:{x:1660,y:780,zone:'city'},gate:{x:1736,y:688,zone:'city'},service:{x:1630,y:620,zone:'city'},gantry:{x:1770,y:590,zone:'city'},records:{x:1872,y:590,zone:'city'},pickup:{x:1700,y:770,zone:'city'},canal:{x:880,y:1376,zone:'city'},market:{x:2150,y:1376,zone:'city'},extract:{x:2120,y:1630,zone:'city'},shop:{x:400,y:370,zone:'city'},lunch:{x:1184,y:1120,zone:'city'},tow:{x:1260,y:1170,zone:'city'}},
 // Every mission uses these declarative goal kinds. Expansion adds data, never callbacks.
 missions:{
  meter:{schema:1,id:'meter',name:'THE METER JOB',reward:1800,stages:[
   {id:'brief',kind:'interact',target:'brief',title:'Meet the crew at Marigold Garage',line:'MARA: MeterMint charges us to stop at red lights. Let us audit their books.'},
   {id:'wheels',kind:'vehicle',target:'valet',title:'Borrow a getaway car from Valet Court',line:'TEO: Four seats. A working engine. Ownership is negotiable.'},
   {id:'scoutCanal',kind:'reach',target:'canal',vehicle:true,title:'Scout Canal Road. Mark an escape route',line:'TEO: The canal camera is blind at the turn. Remember it.'},
   {id:'scoutMarket',kind:'reach',target:'market',vehicle:true,title:'Circle Market Loop. Check the patrol route',line:'KIT: Two exits. No dead ends. Now we can hit the depot.'},
   {id:'survey',kind:'reach',target:'survey',vehicle:true,title:'Check Boardwalk Avenue. Then head for the depot',line:'MARA: Last pass. Get the patrol pattern before we make our move.'},
   {id:'stage',kind:'reach',target:'staging',vehicle:true,title:'Drive to the depot staging area',save:true,line:'KIT: Two ways in. The service gate is quiet. The front gate is quick.'},
   {id:'entry',kind:'entry',target:'service',title:'Open the service gate or force the barrier',line:'TEO: Quiet does not mean easy. It means the trouble arrives later.'},
   {id:'relay',kind:'flag',flag:'relay',target:'gantry',actor:'teo',title:'Switch to Teo. Cross the service gantry',line:'MARA: Teo takes the relay. Kit, watch the yard. I will keep the car ready.'},
   {id:'ledger',kind:'flag',flag:'ledger',target:'records',title:'Enter Records. Copy the payment ledger',save:true,line:'TEO: They charged us a fee for reading the fee schedule.'},
   {id:'crew',kind:'gather',target:'pickup',title:'Return to the car. Bring the whole crew',line:'KIT: Everybody comes home. The ledger is not worth one of us.'},
   {id:'escape',kind:'escape',target:'canal',title:'Lose the patrols. Use Canal Road or Market Loop',line:'MARA: Break their view. Change the car if you have to.'},
   {id:'delivery',kind:'deliver',target:'extract',title:'Deliver the ledger to Broadcast Pier',line:'RADIO: You are live, Sunspoke. Tonight: the fine print.'}
  ]}
 },
 props:['barrel','crate','bench','streetLamp','palm','planter','bollard','dumpster','meter','awning','sign','chair','table','hydrant','cone','barrier','fence','aircon','antenna','buoy','terminal','camera','relay'],
 caps:{cars:14,peds:24,police:6,guards:8,crew:3,bullets:128,particles:400,lights:12,voices:24}
};
G.buildMaps=()=>{
 const E=G.E, w=160,h=120,T=16;
 const city=new E.TileMap({w,h,tile:T,types:{
  1:{h:62,top:'#c37e66',side:'#e0b28b',face:'plaster',roof:'tiles',cut:true,cutH:8},
  2:{h:88,top:'#747e89',side:'#c9c4ad',face:'plaster',roof:'slab',cut:true,cutH:8},
  3:{h:48,top:'#ceae76',side:'#f0d09a',face:'plaster',roof:'tiles',cut:true,cutH:8},
  4:{h:12,top:'#9f9f86',side:'#757d73',face:'stone',roof:'slab'},
  5:{h:34,top:'#4e6f6d',side:'#35514f',face:'none',roof:'plain',cut:true,cutH:5}
 },floorTex:(x,y,tag)=>{
  const grain=((Math.floor(x)*17+Math.floor(y)*31)%11)-5;
  if(tag==='water')return [37+grain,100+grain,115+grain];
  if(tag==='road'){const nearX=G.content.roads.x.some(a=>Math.abs(x-a)<2),nearY=G.content.roads.y.some(a=>Math.abs(y-a)<2);const stripe=(nearX&&Math.floor(y/24)%2===0)||(nearY&&Math.floor(x/24)%2===0);return stripe?[207,181,117]:[64+grain,76+grain,82+grain];}
  if(tag==='sand')return [199+grain,175+grain,124+grain];
  if(tag==='grass')return [111+grain,138+grain,104+grain];
  if(tag==='pier')return [139+grain,114+grain,88+grain];
  const seam=Math.floor(x)%16===0||Math.floor(y)%16===0;return seam?[152,151,129]:[181+grain,176+grain,149+grain];
 }});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let X=x*T+8,Y=y*T+8,tag='pave';if(Y>1760)tag='water';else if(Y>1680)tag='sand';else if(X>2390)tag='water';else if(G.content.roads.x.some(a=>Math.abs(X-a)<64)||G.content.roads.y.some(a=>Math.abs(Y-a)<64))tag='road';city.setFloor(x,y,tag,tag==='water');}
 city.roads=G.content.roads;
 // Building footprints leave alleys around each block and wide vehicle approaches.
 const blocks=[];
 const add=(x,y,bw,bh,type,label)=>{city.fill(x,y,bw,bh,type);blocks.push({x:x*T,y:y*T,w:bw*T,h:bh*T,type,label});};
 add(4,3,8,8,3,'SUNSP0KE');add(21,4,18,7,1,'THE SUNSET');add(61,3,23,8,2,'DAILY BAY');add(104,3,23,8,1,'FINE DINING');
 add(3,23,9,19,1,'SEABREEZE');add(24,29,12,13,3,'MARIGOLD');add(38,34,11,9,2,'VALET');
 add(61,23,12,19,3,'LATE LUNCH');add(78,23,11,19,1,'CABANA');
 add(103,23,23,10,2,'METERMINT');add(118,36,8,7,2,'RECORDS');
 add(4,58,8,21,2,'SEA VIEW');add(23,58,12,20,1,'CASA NARANJA');add(39,58,10,15,3,'LAUNDRY');
 add(61,57,10,12,1,'MARKET');add(80,57,9,21,3,'TOW & GO');add(103,58,11,21,3,'MOTOR POOL');add(119,60,8,16,1,'HOTEL NOVA');
 add(4,92,8,13,1,'COAST GUARD');add(23,92,25,13,3,'PUBLIC WORKS');add(61,92,27,12,2,'POWER & LIGHT');add(103,93,18,12,1,'BAY RADIO');
 // Depot yard fence. Each named gate can mutate the shared terrain and invalidate navigation.
 city.fill(101,34,1,9,5);city.fill(102,43,16,1,5);city.fill(108,43,2,1,5);
 city.fill(101,38,1,2,5);
 // Pier stays walkable over water.
 for(let y=102;y<117;y++)for(let x=130;x<138;x++)city.setFloor(x,y,'pier',false);
 const room=new E.TileMap({w:32,h:24,tile:16,types:{1:{h:40,top:'#789393',side:'#536a70',face:'plaster',cut:true,cutH:6},2:{h:12,top:'#bcab86',side:'#796e60',face:'plank'}},floorTex:(x,y)=>Math.floor(x/16+y/16)%2?[83,108,110]:[91,117,116]});
 room.fill(0,0,32,1,1);room.fill(0,23,32,1,1);room.fill(0,0,1,24,1);room.fill(31,0,1,24,1);room.fill(6,5,6,2,2);room.fill(20,5,6,2,2);room.fill(6,12,6,2,2);room.fill(20,12,6,2,2);room.fill(15,2,1,14,1);room.set(15,9,0);room.set(15,10,0);
 const rows=Array.from({length:18},()=>Array(80).fill('.'));for(let x=0;x<80;x++)rows[17][x]='#';
 for(const [a,b,z]of [[8,21,3],[23,37,5],[39,52,7],[54,67,5],[69,77,3]])for(let x=a;x<b;x++)rows[17-z][x]='=';
 for(const [x,top]of [[9,3],[25,5],[41,7],[55,7],[70,5]])for(let z=1;z<=top;z++)rows[17-z][x]='H';
 for(const x of [19,20,36,37,51,52,67,68])rows[17][x]='!';
 const gantry=new E.PlatformMap({rows:rows.map(r=>r.join('')),legend:{'#':1,'=':2,H:3,'!':4},types:{1:{side:'#4e6470',top:'#bdad80'},2:{kind:'oneway',side:'#b8a272',top:'#f0d28b'},3:{kind:'ladder',side:'#dcad62'},4:{kind:'hazard',side:'#e56c53'}},depth:12});
 return {city,records:room,gantry,blocks};
};
})();
