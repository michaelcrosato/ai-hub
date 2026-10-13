/* The Open District expansion. All places, residents, and activities are original. */
(function (root) {
    'use strict';
    const D = root.HARBOR_DATA, E = root.My3D2dge;
    D.version = '1.1.0';
    D.bounds = { minX: -506, maxX: 804, minY: -736, maxY: 589 };
    D.baseline = { npcs: 12, walkableArea: 282808, rectangularArea: 438130, grid: 2 };
    D.districts = [
        { id: 'quay', name: 'South Quay', x: 34, y: 20, w: 770, d: 569, center: [373, 370], color: '#68756a' },
        { id: 'market', name: 'Market Steps', x: -506, y: 0, w: 540, d: 589, center: [-230, 340], color: '#857863' },
        { id: 'canal', name: 'Canal Walk', x: -506, y: -736, w: 540, d: 736, center: [-250, -210], color: '#647d71' },
        { id: 'repair', name: 'Repair Lane', x: 34, y: -736, w: 356, d: 756, center: [196, -412], color: '#697981' },
        { id: 'ferry', name: 'Ferry Square', x: 390, y: -736, w: 414, d: 756, center: [598, -423], color: '#868476' }
    ];
    const rows = [
        ['arai','ARAI LUNCH',-450,65,112,96,62,'#a38c70','#aa614c','tea'],
        ['produce','KEI PRODUCE',-270,55,110,94,50,'#8a936e','#67835c','books'],
        ['tailor','MORI TAILOR',-115,52,120,100,76,'#918270','#7c6265','store'],
        ['tapes','SIDE B TAPES',-460,398,110,94,67,'#748589','#b4845e','arcade'],
        ['bakery','OVEN 06',-269,409,112,88,67,'#a48e73','#a75f45','tea'],
        ['ceramics','BLUE CLAY',-110,412,106,96,71,'#8a8d82','#597b83','books'],
        ['coldstore','ICE HOUSE',-468,220,88,92,83,'#6d8790','#bec4ab','warehouse'],
        ['green','GREEN GROCER',-249,219,88,85,59,'#899877','#58756a','store'],
        ['return','ETSU RETURNS',-463,-140,113,92,51,'#6e8880','#ad9e79','garage'],
        ['tinfish','TIN FISH',-268,-144,105,90,56,'#648b85','#c57551','arcade'],
        ['gallery','WATERLINE',-114,-143,112,86,76,'#919d8b','#658a81','books'],
        ['anglers','TACKLE & LINE',-465,-431,117,93,65,'#768f80','#baa16b','store'],
        ['bath','SALT BATH',-264,-434,105,94,86,'#8a8a8b','#6e8398','store'],
        ['garden','GARDEN ROOM',-107,-444,110,105,64,'#939c81','#a88764','tea'],
        ['apartments','CANAL ROOMS',-461,-693,134,107,104,'#8a8b7b','#76767a','store'],
        ['boatmaker','WOOD & WATER',-247,-694,118,104,80,'#7d8475','#a58b61','garage'],
        ['watch','HARBOR WATCH',-85,-696,96,106,71,'#788b8b','#7e9c8d','store'],
        ['nets','FUMI NETS',59,-679,104,111,67,'#73877a','#b0a173','garage'],
        ['plate','PLATE WORKS',236,-691,111,112,76,'#6c828a','#b1a481','warehouse'],
        ['covers','SAIL & COVER',63,-425,99,100,69,'#8b8a7a','#688c87','books'],
        ['tool','TOOL LIBRARY',245,-428,101,104,70,'#6c8785','#b89771','store'],
        ['chime','TANE COURT',70,-151,102,112,73,'#9a937e','#a17159','tea'],
        ['dorm','WORKERS ROOMS',243,-153,108,112,94,'#7f9190','#769381','store'],
        ['post','FERRY POST',439,-687,116,105,63,'#9c9680','#ae6854','store'],
        ['bus','AONAMI BUS',633,-686,118,101,62,'#738b85','#caaf7c','garage'],
        ['hotel','TIDE HOTEL',442,-427,112,106,110,'#9c9884','#737f83','store'],
        ['canteen','CREW CANTEEN',632,-429,118,108,69,'#8f8870','#b27b57','tea'],
        ['ticket','NORTH FERRY',443,-147,112,106,70,'#8d9c90','#638c89','ferry'],
        ['senda','SIGNAL SCHOOL',634,-148,114,107,66,'#7c908b','#a98a59','store']
    ];
    rows.forEach(([id,name,x,y,w,d,h,color,trim,type]) => D.buildings.push({id,name,x,y,w,d,h,color,trim,type,roof: type === 'garage' ? '#496570' : '#4d6465', expansion:true}));
    D.roads = [
        { x:-500,y:320,w:1304,d:65 }, { x:-500,y:175,w:535,d:38 },
        { x:-500,y:-290,w:1304,d:92 }, { x:-500,y:-550,w:1304,d:78 },
        { x:-500,y:-20,w:1304,d:54 }, { x:-328,y:-735,w:47,d:1325 },
        { x:-151,y:-735,w:32,d:1325 }, { x:183,y:-735,w:45,d:770 },
        { x:368,y:-735,w:51,d:800 }, { x:573,y:-735,w:43,d:864 },
        { x:760,y:-735,w:42,d:1325 }
    ];
    D.activityDefs = [
        { id:'lunch', name:'Lunch Rush', host:'arai', place:'Market Steps', x:-327,y:183, reward:80, keepsake:'Paper lunch ticket', desc:'Carry three lunch orders from Arai’s counter to the right tables. A full round has a 90-second target.' },
        { id:'oranges', name:'Loose Oranges', host:'kei', place:'Market Steps', x:-234,y:176, reward:50, keepsake:'Wooden orange charm', desc:'Catch five rolling oranges before they reach the drains. The target is 60 seconds.' },
        { id:'post', name:'Ferry Post', host:'mika', place:'Ferry Square', x:488,y:-556, reward:80, keepsake:'Aonami postcard', desc:'Find three named residents and deliver their letters. There is no deadline. Beat three minutes for a personal record.' },
        { id:'signal', name:'Signal Practice', host:'senda', place:'Ferry Square', x:694,y:-19, reward:50, keepsake:'Signal card', desc:'Copy six flag signals with the arrow keys or the matching buttons. A missed signal repeats.' },
        { id:'bottles', name:'Bottle Return', host:'etsu', place:'Canal Walk', x:-391,y:-19, reward:30, keepsake:'Blue sea glass', desc:'Find six colored bottles along the canal paths. Bring each color to its matching return rack.' },
        { id:'tinfish', name:'Tin Fish', host:'haru', place:'Canal Walk', x:-219,y:-20, reward:40, keepsake:'Ferry pin', desc:'Throw five soft balls. Press E or Throw when the aim reaches the gold center. Score 70 to win.' },
        { id:'nets', name:'Net Repair', host:'fumi', place:'Repair Lane', x:100,y:-545, reward:50, keepsake:'Woven harbor knot', desc:'Walk to each of the three net frames. Make two knots at each frame by stopping the marker in the gold band.' },
        { id:'chimes', name:'Wind Chime Round', host:'tane', place:'Repair Lane', x:205,y:-172, reward:40, keepsake:'Paper fish decoration', desc:'Walk around Tane Court and ring four chimes in the order shown. The target is 90 seconds.' }
    ];
    const hosts = [['arai','Mrs. Arai','#b87955'],['kei','Kei','#84966b'],['mika','Mika','#927584'],['senda','Mr. Senda','#738e97'],['etsu','Etsu','#9b946b'],['haru','Haru','#c1865d'],['fumi','Fumi','#668b89'],['tane','Tane','#a59b83']];
    hosts.forEach(([id,name,color],i) => { const a=D.activityDefs.find(a=>a.host===id); D.npcs.push({id,name,role:a.name+' · '+a.place,x:a.x,y:a.y,color,pants:'#354c55',hair:i%3?'#393f43':'#c7c2ad',size:.86+(i%3)*.05,pose:'hips',activity:a.id}); });
    D.busStops = [
        { id:'bus-quay',name:'South Quay',x:416,y:400 },
        { id:'bus-market',name:'Market Steps',x:-129,y:355 },
        { id:'bus-canal',name:'Canal Walk',x:-129,y:-240 },
        { id:'bus-repair',name:'Repair Lane',x:205,y:-512 },
        { id:'bus-ferry',name:'Ferry Square',x:592,y:-521 }
    ];
    D.busStops.forEach(b=>D.props.push({...b,name:b.name+' bus stop',type:'bus',r:25}));
    D.scenery = [];
    for (let y=-670;y<581;y+=127) D.scenery.push({type:'tree',x:-486,y},{type:'lamp',x:-288,y:y+14});
    for (let x=-443;x<780;x+=135) { D.scenery.push({type:'lamp',x,y:-198},{type:'lamp',x,y:-469},{type:'planter',x,y:32}); }
    for (let x=-445;x<-20;x+=87) D.scenery.push({type:'stall',x,y:227},{type:'flags',x,y:196});
    for (const [x,y] of [[-394,-306],[-224,-315],[-64,-314],[-415,-557],[-196,-559],[186,-49],[595,-458],[580,-182],[-303,507]]) D.scenery.push({type:'bench',x,y});
    D.scenery.push({type:'pond',x:-400,y:-226},{type:'bikes',x:565,y:-556},{type:'bus',x:657,y:-506},{type:'net',x:89,y:-494},{type:'net',x:141,y:-490},{type:'net',x:290,y:-490});
    // Stable seeded residents. Routes use clear line segments and never cross buildings.
    const blocked = (x,y,r=13) => D.buildings.some(b=>Math.hypot(x-E.clamp(x,b.x,b.x+b.w), y-E.clamp(y,b.y,b.y+b.d))<r);
    const props = D.props.concat(D.npcs), occupied=props.map(p=>[p.x,p.y]);
    const first=['Aki','Ren','Nori','Mao','Yoko','Hiro','Sumi','Toru','Kiko','Daichi','Masa','Chiyo','Riku','Mina','Isao','Yuna','Kenta','Suzu'];
    const surnames=['Ono','Abe','Kubo','Ito','Ueda','Seki'];
    const roles=['A neighbor','Shop assistant','Evening shift','Ferry passenger','On an errand','Out for a walk'];
    const barks=[
        ['The salt gets into every seam.','One more sleeve. Then I can close.'],
        ['I came for onions. I bought half the stall.','The good onions went quickly.'],
        ['The new tape keeps getting stuck.','I will fix the player after supper.'],
        ['You can see the ferry from the north square.','I should be home before the lamps come on.'],
        ['The small fish know when I sit down.','One last cast. I said that half an hour ago.'],
        ['The reflection changes before the wall does.','I will paint the sky tomorrow.'],
        ['The short route has the most stairs.','These shoes have done enough for one day.'],
        ['We came to count boats. We lost count.','That must be the last boat. Surely.'],
        ['This case felt lighter at home.','A warm room will do very nicely.'],
        ['One cloud can change the whole view.','There is still enough light for one picture.'],
        ['I have six minutes for tea.','The last route is usually quiet.'],
        ['I put the good wrench somewhere safe.','Found the wrench. Under the other wrench.'],
        ['You can hear a loose plate before you see it.','The yard sounds different after the shift.'],
        ['Boat covers need stronger thread.','This cover is ready for the morning boat.'],
        ['Try the tin fish by the canal. Haru keeps score.','Keep to the lit path by the water.'],
        ['The bus stops at all five neighborhoods. Twenty yen.','The bus driver still has a few rounds left.'],
        ['Arai needs a hand at lunchtime. Ask her at the market.','I can still smell the rice at Arai’s stall.'],
        ['Fumi teaches a good knot. It is harder than it looks.','The nets will be ready for tomorrow.']
    ];
    const palette=['#9a7867','#60878b','#a49c73','#85875d','#7b6e88','#b18060','#658577','#a16f69','#6a8297','#a8aba0'];
    let made=0;
    for(let attempt=0; made<108 && attempt<20000; attempt++) {
        const x=-480+E.hash2(attempt,783)*1260,y=-710+E.hash2(attempt,194)*1270;
        if(blocked(x,y) || occupied.some(p=>Math.hypot(p[0]-x,p[1]-y)<40)) continue;
        const angle=E.hash2(attempt,99)*Math.PI*2, len=20+E.hash2(attempt,119)*50;
        const ex=E.clamp(x+Math.cos(angle)*len,-481,779), ey=E.clamp(y+Math.sin(angle)*len,-711,563);
        let clear=true; for(let k=1;k<=12;k++) if(blocked(E.lerp(x,ex,k/12),E.lerp(y,ey,k/12),8)) clear=false;
        const id='resident-'+made, i=made;
        D.npcs.push({id,name:first[i%18]+' '+surnames[Math.floor(i/18)%6],role:roles[i%6],x,y,color:palette[i%10],pants:['#384c53','#484a50','#435a55'][i%3],hair:i%7===0?'#c8c3ad':'#333b3c',hairStyle:i%5===0?'ponytail':'short',size:.79+(i%6)*.04,ambient:true,route:clear?[[x,y],[ex,ey]]:[[x,y],[x,y]],barks:barks[i%18],pauseSeed:i*.19});
        occupied.push([x,y]); made++;
    }
    D.landmarks.push(...D.districts.slice(1).map(a=>({name:a.name,x:a.center[0],y:a.center[1]})));
})(window);
