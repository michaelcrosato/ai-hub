/* SOURCE: content/ashwick/world.js */
/* THE HOLLOW BELL — original handcrafted Ashwick level.
 * my-3D2dge v0.34.0 public TileMap, texture, prop and renderer APIs.
 * All positions are world units (16 units per tile). */
(() => {
'use strict';
const builders = globalThis.HBRegionBuilders ||= {};
builders.ashwick = function createAshwickArt(E, region) {
    const T = region.tileSize || 16, W = region.width, H = region.height, px = E.px;
    const {cells, floors, blocked} = globalThis.HBWorld.geometry(region);
    const props = [], furnishings = [], trees = [];
    const at = (x,y) => y*W+x;
    function prop(name,x,y,size=1,color,extra={}) { const p={name,x,y,z:0,opts:{size,...extra}}; if(color)p.opts.color=color; props.push(p); return p; }
    function furnishing(kind,x,y,opts={}) { furnishings.push({kind,x,y,...opts}); }
    const palettes = {
      stone:{stones:['#69756b','#778171','#7d8676','#637265'].map(E.hex),mortar:E.hex('#4c5c52'),hi:E.hex('#939983'),lo:E.hex('#596456'),speck:E.hex('#516251')},
      chapel:{stones:['#818479','#777e77','#97988b'].map(E.hex),mortar:E.hex('#4e615d'),hi:E.hex('#afb0a0'),lo:E.hex('#596761'),speck:E.hex('#64746c')},
      crypt:{stones:['#384f50','#425c59','#3c5554'].map(E.hex),mortar:E.hex('#213d40'),hi:E.hex('#5d7570'),lo:E.hex('#2b4749'),speck:E.hex('#263e43')},
      warmstone:{stones:['#88785a','#938164','#9d8a69'].map(E.hex),mortar:E.hex('#665a45'),hi:E.hex('#b3a17d'),lo:E.hex('#73674e'),speck:E.hex('#6f654e')},
      quay:{stones:['#6d8078','#73877e','#61796f'].map(E.hex),mortar:E.hex('#435f59'),hi:E.hex('#8b9d8d'),lo:E.hex('#516c61'),speck:E.hex('#496456')}
    };
    function floorTex(x,y,tag) {
      if(palettes[tag]) return E.tex.flagstone(x,y,palettes[tag],tag==='crypt'?24:16);
      if(tag==='water')return E.tex.water(x,y,{base:'#22575b',dark:'#1d4b52',light:'#6a9b91'});
      if(tag==='wood'||tag==='dock')return E.tex.planks(x,y,tag==='wood'?{base:'#8b6b47',dark:'#73543b',line:'#4f4435'}:{base:'#72634c',dark:'#62553f',line:'#384e47'});
      if(tag==='garden') {
        if(Math.floor(y/8)%2===0)return E.tex.dirt(x,y,{base:'#5c5840',dark:'#424c36',light:'#7c704d'});
        return E.tex.grass(x,y,{base:'#5c7244',dark:'#465e39',light:'#78884c',flower:'#d8b55d'});
      }
      if(tag==='dirt')return E.tex.dirt(x,y,{base:'#83815a',dark:'#646d49',light:'#979067'});
      return E.tex.grass(x,y,{base:tag==='forest'?'#3b5746':'#667a4c',dark:'#475f40',light:'#7d8954',flower:'#d1a663',flower2:'#aab27b'});
    }
    const timber = {h:45,top:'#ad613c',side:'#c9b17c',line:'#634d36',face:'timber',beam:'#5a4631',roof:'tiles',windows:{spacing:48,width:8,height:14,bottom:17},shutters:true};
    const stone = {h:53,top:'#667871',side:'#a5aa8d',line:'#596b60',face:'stone',roof:'slab'};
    const darkstone = {h:49,top:'#526b60',side:'#61796a',line:'#334e4a',face:'stone',roof:'slab'};
    const map = new E.TileMap({w:W,h:H,cells,floor:floors,blocked,ao:4,floorTex,types:{
      1:{...timber},2:{...timber,cut:true,cutH:9},
      3:{...stone},4:{...stone,cut:true,cutH:10},
      5:{...darkstone},6:{...darkstone,cut:true,cutH:10},
      7:{h:26,top:'#466047',side:'#354c3c',face:'hedge',roof:'leaves',cut:true,cutH:12},
      8:{h:9,top:'#647342',side:'#55623b',face:'hedge',roof:'leaves'},
      9:{h:5,top:'#8d8870',side:'#4e6256',face:'stone',roof:'slab'}
    }});
    // Mature trees frame streets; the centre stays open for sightlines and movement.
    const treePoints=[[64,70,1.9],[114,54,1.6],[186,64,2],[270,75,1.9],[295,150,1.4],
      [535,52,1.9],[602,80,2],[690,65,1.8],[739,134,1.5],[38,193,1.6],[37,298,1.9],
      [73,354,1.5],[39,417,1.9],[48,525,1.7],[120,555,1.4],[261,538,1.6],
      [309,497,1.4],[650,529,1.9],[714,473,1.8],[726,566,1.7],[534,469,1.2],
      [481,272,1.4],[283,300,1.2],[300,243,1.15],[539,182,1.35]];
    treePoints.forEach(([x,y,s],i)=>{const color=['#a17637','#a78842','#6c7c44','#c28a43','#617848'][i%5];prop('tree',x,y,s,color,{variant:i});trees.push({x,y,r:19*s});});
    [[78,99],[219,80],[300,70],[661,78],[741,185],[30,347],[75,552],[609,538],[690,547]].forEach(([x,y],i)=>prop('bush',x,y,1.1,'#596b40',{berries:i%2?'#b59351':null,variant:i}));
    const rnd=E.rng(4731);
    for(let i=0;i<65;i++) {
      const x=32+rnd()*690,y=32+rnd()*535,cx=Math.floor(x/16),cy=Math.floor(y/16),tag=floors[at(cx,cy)];
      if(!cells[at(cx,cy)]&&(tag==='grass'||tag==='forest'))prop(i%4===0?'flowers':i%7===0?'rock':'grass',x,y,.7+rnd()*.5,i%4===0?'#d4aa61':i%7===0?'#819076':'#7a8550',{variant:i});
    }
    // Lanterns make a readable gold route from ferry to market, chapel and gate.
    [[347,578],[445,580],[318,454],[460,471],[287,362],[435,342],[304,211],[476,205],[528,344],[580,354],[165,290],[258,442],[354,208]].forEach(([x,y],i)=>prop('streetlamp',x,y,1.05,'#485747',{light:true,lightIntensity:.45,lightRadius:65,haloR:10,variant:i}));
    [[83,143],[237,142],[104,489],[232,402],[366,84],[477,84],[585,246],[705,247],[585,402]].forEach(([x,y],i)=>prop('candle',x,y,1.35,'#ebd4a0',{light:true,variant:i}));
    // Workshop: tools, unfinished castings, storage and the physical crate puzzle.
    furnishing('table',104,242,{w:40,d:18,tools:true});
    prop('barrel',94,187,1.4,'#84664a');prop('barrel',95,208,1.15,'#84664a');
    prop('pot',224,250,1.4,'#a07853');prop('lantern',132,136,1.15,'#d99a4c',{light:true});
    prop('sign',241,268,1.15,'#916b46');prop('brazier',226,140,1.4,'#4f615e',{light:true});
    furnishing('rack',87,145,{w:26});
    // Bakery: glowing brick oven, flour, loaves, herb-fed kitchen and busy counter.
    furnishing('table',128,479,{w:50,d:20,bread:true});
    furnishing('table',218,418,{w:30,d:18,bread:true});
    prop('pot',84,454,1.5,'#b68150');prop('pot',99,464,1,'#c39762');
    prop('barrel',215,482,1.35,'#87674a');prop('awning',183,382,1.7,'#ad6c46',{color2:'#d8c493',hides:false});
    prop('sign',255,471,1.1,'#996f44');prop('flowers',94,505,1.4,'#d1aa68');
    // Silverleaf beds have a different soil texture and a little potting bench.
    for(let i=0;i<12;i++)prop('flowers',82+(i%6)*20,302+Math.floor(i/6)*22,1.1,'#b7cf94',{color2:'#d9d5a1',variant:i});
    furnishing('table',183,309,{w:24,d:12,herbs:true});prop('pot',188,334,1.2,'#937753');
    // Chapel: patterned aisle, benches, stained glass, altar and intimate evidence.
    furnishing('altar',423,94,{w:75,d:20});
    for(const x of [378,468])for(const y of [147,181])furnishing('bench',x,y,{w:31,d:9});
    prop('window',423,65,2.5,'#7e8e7b',{colors:['#dcaa5c','#4d8b8b','#bd694b','#c3c6a1'],hides:false});
    prop('banner',353,117,1.5,'#315e64',{emblem:'#d4b26e'});prop('banner',489,117,1.5,'#315e64',{emblem:'#d4b26e'});
    prop('candelabra',367,107,1.2,'#b6a064',{light:true});prop('candelabra',485,107,1.2,'#b6a064',{light:true});
    // Bell market: striped stalls, cloth, baskets, fire bowl and hand-set paving.
    furnishing('stall',315,303,{cloth:'#966444',produce:true});
    furnishing('stall',420,303,{cloth:'#527d74',produce:true});
    furnishing('bench',315,408,{w:30,d:10});furnishing('bench',407,382,{w:30,d:10});
    prop('barrel',291,328,1.2,'#8d6c48');prop('crate',435,293,1.1,'#887349');
    prop('pot',312,313,1.25,'#b38152');prop('flowers',462,375,1.4,'#d6ae5e');
    prop('sign',374,481,1.15,'#95734e');prop('brazier',405,463,1.15,'#56665a',{light:true});
    // Inn and harbour tell the arrival story without needing another map.
    furnishing('table',505,526,{w:28,d:18,bread:true});
    prop('candle',506,526,1,'#dec995',{light:true});prop('barrel',482,555,1.25,'#8b7251');
    prop('sign',466,552,1.1,'#a08555');prop('awning',540,488,1.55,'#5b7a73',{color2:'#d7c598'});
    [[362,626],[358,650],[434,655],[479,596],[492,596],[270,594],[248,592]].forEach(([x,y],i)=>prop(i%3?'barrel':'crate',x,y,1.15,'#867450',{variant:i}));
    furnishing('boat',481,653,{flip:false});furnishing('boat',292,637,{flip:true});
    prop('lantern',382,663,1.1,'#d3a356',{light:true});
    // Undercroft: restraints, old machinery and a circular ritual floor.
    [[576,250],[704,250],[576,401],[704,403]].forEach(([x,y],i)=>prop('pillar',x,y,1.25,'#698279',{broken:i===2}));
    prop('brazier',583,310,1.3,'#435f5c',{light:true,flame:'#86d8bf',flameOut:'#338e8c'});
    prop('brazier',714,310,1.3,'#435f5c',{light:true,flame:'#86d8bf',flameOut:'#338e8c'});
    prop('bones',600,387,1.1,'#97a28a');prop('skull',575,372,1,'#a7af97');
    prop('cobweb',718,226,2,'#87968a',{anchor:'top'});prop('vines',567,235,1.5,'#687e59',{anchor:'top'});
    furnishing('chains',706,387);furnishing('table',620,400,{w:38,d:18,tools:true});
    // Ground decorations use world geometry so camera rotation/zoom remains correct.
    function poly(r,g,points,color){px.poly(g,points.map(p=>r.w(p[0],p[1],p[2]||0)),color);}
    function line(r,g,a,b,color,width=1){const p=r.w(...a),q=r.w(...b);px.line(g,p[0],p[1],q[0],q[1],color,width);}
    function box(r,g,x,y,z,w,d,h,top,side){r.box(g,x-w/2,y-d/2,z,x+w/2,y+d/2,z+h,top,side);}
    function furniture(r,item,time) {
      const {kind,x,y}=item;
      if(!r.visible(x,y,20,75,80,95))return;
      r.queue(x,y,0,g=>{
        const w=item.w||40,d=item.d||18;
        const legs=(ww,dd,hh=16)=>{for(const dx of [-ww/2+3,ww/2-3])for(const dy of [-dd/2+3,dd/2-3])box(r,g,x+dx,y+dy,0,3,3,hh,'#846346','#584934');};
        if(kind==='table'||kind==='bench'||kind==='altar') {
          const h=kind==='bench'?10:kind==='altar'?17:16;legs(w,d,h);box(r,g,x,y,h,w,d,3,kind==='altar'?'#b6b18b':'#aa8759',kind==='altar'?'#687c6a':'#725b3f');
          if(item.cloth||kind==='altar')poly(r,g,[[x-w*.35,y-d/2, h+3.3],[x+w*.35,y-d/2,h+3.3],[x+w*.35,y+d/2,h+3.3],[x-w*.35,y+d/2,h+3.3]],item.cloth||'#356b6d');
          if(item.bread)for(let i=0;i<4;i++){const p=r.w(x-w*.3+i*w*.2,y,20);px.ell(g,p[0],p[1],4*(r.view.zoom||1),2*(r.view.zoom||1),i%2?'#e4bc75':'#c79b54');px.dot(g,p[0]-1,p[1]-1,'#f3d99b');}
          if(item.herbs)for(let i=0;i<3;i++)line(r,g,[x-7+i*6,y-3,20],[x-10+i*6,y+4,20],'#bcc98b',2);
          if(item.tools){box(r,g,x-8,y-2,20,10,8,1,'#c7b88e','#8f825e');line(r,g,[x+5,y+3,21],[x+12,y-5,21],'#bd9b69',2);box(r,g,x+13,y-5,21,6,4,3,'#77867b','#455854');}
          if(kind==='bench'){box(r,g,x,y-d/2,9,w,2,15,'#8d724c','#5e553d');}
        } else if(kind==='stall') {
          legs(40,22,18);box(r,g,x,y,18,42,23,3,'#b09669','#765e40');
          for(const dx of [-21,21])box(r,g,x+dx,y-8,0,2,2,46,'#b39259','#655339');
          for(let i=0;i<7;i++)poly(r,g,[[x-23+i*7,y-13,49],[x-16+i*7,y-13,49],[x-16+i*7,y+13,41],[x-23+i*7,y+13,41]],i%2?'#d6c18f':item.cloth);
          for(let i=0;i<6;i++){const p=r.w(x-15+i*6,y+3,23);px.disc(g,p[0],p[1],2.1,i%2?'#b98445':'#9aab5e');}
        } else if(kind==='oven') {
          box(r,g,x,y,0,28,24,7,'#9b8565','#6b6851');box(r,g,x,y,7,26,22,27,'#cda578','#986e4a');box(r,g,x-7,y-7,33,10,10,26,'#ad8a60','#866745');
          const p=r.w(x,y+12,14),s=r.view.zoom||1;px.disc(g,p[0],p[1]-4*s,7*s,'#463b2b');px.rect(g,p[0]-7*s,p[1]-4*s,14*s,7*s,'#463b2b');px.ell(g,p[0],p[1]+s,5*s,2*s,'#d57d38');px.ell(g,p[0],p[1],3*s,2*s,'#eec871');
          line(r,g,[x-12,y+12,27],[x+12,y+12,27],'#dfbd8c');
        } else if(kind==='rack') {
          box(r,g,x,y,0,w,8,29,'#876e46','#645538');for(let j=1;j<3;j++){box(r,g,x,y,10*j,w+2,10,2,'#b49868','#705d3c');for(let i=0;i<4;i++)box(r,g,x-w/2+4+i*5,y+3,10*j+2,3,3,7,'#a0ac8e',i%2?'#63877c':'#ad8c5a');}
        } else if(kind==='lectern') {
          legs(16,13,21);box(r,g,x,y,21,21,15,3,'#9e895f','#685e45');
          poly(r,g,[[x-9,y-5,25],[x,y-4,26],[x+9,y-5,25],[x+9,y+6,25],[x,y+7,26],[x-9,y+6,25]],'#d5c69c');line(r,g,[x,y-4,26],[x,y+7,26],'#8b835e');
        } else if(kind==='offering') { const p=r.w(x,y,24),s=r.view.zoom||1;px.ell(g,p[0],p[1],7*s,3*s,'#bba965');px.ell(g,p[0],p[1]-s,5*s,2*s,'#665d3b');for(let i=0;i<4;i++)px.dot(g,p[0]-3+i*2,p[1]-2,'#e0c279');
        } else if(kind==='bed') {
          legs(23,37,8);box(r,g,x,y,8,25,38,5,'#d5c496','#746c4c');box(r,g,x,y+5,13,25,25,2,'#607e78','#436861');box(r,g,x,y-11,13,19,10,3,'#e0d2a5','#ada480');box(r,g,x,y-20,0,27,3,26,'#9e8658','#6e6245');
        } else if(kind==='boat') {
          const yy=time?Math.sin(time*.8+x)*.7:0;
          poly(r,g,[[x-37,y,2+yy],[x-22,y-16,3+yy],[x+25,y-13,3+yy],[x+42,y,2+yy],[x+25,y+13,2+yy],[x-22,y+16,2+yy]],'#745b40');
          poly(r,g,[[x-31,y,4+yy],[x-20,y-10,5+yy],[x+25,y-8,5+yy],[x+34,y,4+yy],[x+24,y+8,4+yy],[x-20,y+10,4+yy]],'#3d4a3a');
          for(const xx of [-17,0,17])box(r,g,x+xx,y,6+yy,5,25,2,'#aa8b57','#786644');line(r,g,[x-25,y-27,8],[x+27,y+24,8],'#b89e6b',2);
        } else if(kind==='chains') {
          for(let i=0;i<7;i++){const p=r.w(x,y,10+i*3);px.ell(g,p[0]+(i%2),p[1],2,2,'#91a28f');}
        }
      },{hides:true,solid:true});
    }
    function bell(r,entity,state,time) {
      const {x,y}=entity;
      if(!r.visible(x,y,28,50,95,45))return;
      r.queue(x,y,0,g=>{
        box(r,g,x,y,0,44,39,4,'#9b9c79','#5d7360');box(r,g,x,y,4,36,31,3,'#afb08a','#70816a');
        for(const xx of [-17,17]){box(r,g,x+xx,y,7,5,7,53,'#ae8c56','#5a4b34');box(r,g,x+xx,y,7,11,13,4,'#8e805a','#5d6047');}
        box(r,g,x,y,57,44,11,6,'#bc985f','#6b533a');
        const p=r.w(x,y,31),s=r.view.zoom||1;
        px.poly(g,[[p[0]-8*s,p[1]-15*s],[p[0]+8*s,p[1]-15*s],[p[0]+10*s,p[1]-s],[p[0]+16*s,p[1]+8*s],[p[0]-16*s,p[1]+8*s],[p[0]-10*s,p[1]-s]],'#b99550');
        px.poly(g,[[p[0]+4*s,p[1]-14*s],[p[0]+8*s,p[1]-14*s],[p[0]+10*s,p[1]],[p[0]+16*s,p[1]+8*s],[p[0]+4*s,p[1]+8*s]],'#806d3e');
        px.ell(g,p[0],p[1]+8*s,16*s,3*s,'#524e37');px.ell(g,p[0],p[1]+6*s,16*s,2*s,'#d3b366');
        px.line(g,p[0]-5*s,p[1]-12*s,p[0]-7*s,p[1]+3*s,'#e4c57d',2*s);px.line(g,p[0]+s,p[1]-12*s,p[0]-s,p[1]+4*s,'#544e34',s);
        px.disc(g,p[0],p[1]+10*s,2*s,'#b39b62');
        line(r,g,[x,y,48],[x,y,58],'#483e2b',2);
        // Distinct cracked bell with a little votive ribbon.
        line(r,g,[x+17,y+4,48],[x+18,y+5,30],'#659785',2);
      },{hides:true,solid:true});
      if(state?.ending)r.decal(()=>r.groundRing(x,y,30+Math.sin(time)*3,'#c2b278',.4));
    }
    function well(r,entity,state,time) {
      const {x,y}=entity;if(!r.visible(x,y,18,45,70,40))return;r.queue(x,y,0,g=>{
        const s=r.view.zoom||1,p=r.w(x,y,9);px.ell(g,p[0],p[1]+5*s,15*s,8*s,'#536b59');px.rect(g,p[0]-15*s,p[1]-3*s,30*s,8*s,'#71816a');px.ell(g,p[0],p[1]-4*s,15*s,7*s,'#b3ae83');px.ell(g,p[0],p[1]-4*s,10*s,4*s,'#28595c');px.ell(g,p[0]-2*s,p[1]-5*s,5*s,2*s,'#4e9690');
        for(const xx of [-15,15])box(r,g,x+xx,y,0,3,4,36,'#a68959','#6a593f');box(r,g,x,y,34,36,6,4,'#bd9f67','#6a593f');line(r,g,[x,y,37],[x,y,12],'#c4ae77');
      },{hides:true,solid:true});
    }
    function resonator(r,entity,state,time) {
      const {x,y}=entity;if(!r.visible(x,y,28,75,95,55))return;
      const done=!!(state?.ending||state?.flags?.resolved),glow=done?'#d4b46b':'#65b8a9';
      r.decal(g=>{r.groundRing(x,y,40,'#789c83',.8);r.groundRing(x,y,34,glow,.4);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(r,g,[x+Math.cos(a)*31,y+Math.sin(a)*31,0],[x+Math.cos(a)*39,y+Math.sin(a)*39,0],glow);}});
      r.queue(x,y,0,g=>{
        box(r,g,x,y,0,30,30,5,'#748c75','#3c5952');box(r,g,x,y,5,20,20,15,'#7b927b','#47645b');
        const p=r.w(x,y,37),s=r.view.zoom||1;px.ell(g,p[0],p[1],19*s,23*s,'#547b70');px.ell(g,p[0],p[1],15*s,19*s,'#273e40');px.ell(g,p[0],p[1],17*s,21*s,glow);px.ell(g,p[0],p[1],14*s,18*s,'#233d40');
        px.poly(g,[[p[0],p[1]-12*s],[p[0]+7*s,p[1]],[p[0],p[1]+12*s],[p[0]-7*s,p[1]]],glow);px.line(g,p[0]-2*s,p[1]-6*s,p[0]-2*s,p[1]+3*s,'#c3e8c1',2*s);
        for(let i=0;i<3;i++){const a=time*.6+i*2.094;px.dot(g,p[0]+Math.cos(a)*11*s,p[1]+Math.sin(a)*15*s,'#c5e4bd');}
      },{emissive:true,hides:true,solid:true});
    }
    // Infinite sea behind the finite play space. Bake texture once for each view;
    // copies move with the camera, and the opaque level floor covers the inland part.
    let oceanTile=null,oceanView='';
    function ocean(r,time) {
      const key=r.view.id+':'+r.view.scale;
      if(!oceanTile||oceanView!==key){
        oceanView=key;oceanTile=E.mkCanvas(128,128);const g=oceanTile.getContext('2d'),im=g.createImageData(128,128);
        for(let y=0;y<128;y++)for(let x=0;x<128;x++){
          const w=r.view.toGround(x,y)||[x,y],c=E.tex.water(w[0],w[1],{base:'#22575b',dark:'#1d4b52',light:'#6a9b91'}),j=(y*128+x)*4;
          im.data[j]=c[0];im.data[j+1]=c[1];im.data[j+2]=c[2];im.data[j+3]=255;
        }g.putImageData(im,0,0);
      }
      r.sky(['#1d4b52','#22575b']);
      const ox=((r.ix%128)+128)%128,oy=((r.iy%128)+128)%128;
      for(let y=-oy;y<r.H+2;y+=128)for(let x=-ox;x<r.W+2;x+=128)r.ctx.drawImage(oceanTile,x,y);
      // Sparse wind-driven glints are drawn before the land, never across a room.
      for(let i=0;i<42;i++){
        const x=((E.hash2(i,79)*(r.W+80)-r.ix*.12+time*1.8)%(r.W+80)+(r.W+80))%(r.W+80)-40;
        const y=((E.hash2(i,123)*(r.H+40)-r.iy*.12)%(r.H+40)+(r.H+40))%(r.H+40)-20;
        px.rect(r.ctx,x,y,2+(i%3),1,'#63968e');
      }
    }
    function draw(r,state,time=0) {
      ocean(r,time);map.drawFloor(r);map.queueWalls(r);
      r.decal(g=>{
        // An inlaid stone medallion ties the bell to the undercroft machine.
        if(r.visible(360,344,0,85,45,45)){r.groundRing(360,344,48,'#a5a782',.6);r.groundRing(360,344,44,'#586e5c',.65);
        for(let i=0;i<12;i++){const a=i*Math.PI/6;line(r,g,[360+Math.cos(a)*42,344+Math.sin(a)*42,0],[360+Math.cos(a)*48,344+Math.sin(a)*48,0],'#bbb78b');}}
        if(r.visible(423,150,0,80,85,85)){poly(r,g,[[408,107,0],[438,107,0],[438,197,0],[408,197,0]],'#416d67');
        for(let y=114;y<198;y+=14){line(r,g,[410,y,0],[436,y,0],'#8d9a74');}}
        for(let i=0;i<trees.length;i++){const a=trees[i];if(!r.visible(a.x,a.y,0,50,35,35))continue;for(let k=0;k<6;k++){const n=E.hash2(i,k);const p=r.w(a.x+Math.cos(k*2.4)*a.r*n,a.y+Math.sin(k*2.4)*a.r*n,0);px.rect(g,p[0],p[1],2,1,['#a38b46','#bd9653','#927848'][k%3]);}}
        // A small blood trace is a clue; its direction points back toward the crypt.
        if(r.visible(160,189,0,30,30,30))for(let i=0;i<5;i++){const p=r.w(149+i*4,184+i*2,0);px.disc(g,p[0],p[1],i%2?1:2,'#805b46');}
      });
      for(const p of props)if(r.visible(p.x,p.y,p.z,75,100,100))r.prop(p.name,p.x,p.y,p.z,p.opts);
      for(const p of furnishings)furniture(r,p,time);
      // Overhead pennants give the market a lived-in, wind-touched silhouette.
      if(r.visible(365,439,32,95,65,65))r.queue(365,439,0,g=>{
        line(r,g,[315,439,41],[420,439,41],'#6f7451');
        for(let i=0;i<8;i++){const x=321+i*12,bob=Math.sin(time*1.5+i)*1.5;poly(r,g,[[x,439,40],[x+8,439,40],[x+5,439+bob,29]],i%2?'#aa794b':'#648b7a');}
      },{hides:false});
    }
    const baseProps=props.slice(),baseFurnishings=furnishings.slice();
    function benchmarkDensity(density=1) {
      props.splice(0,props.length,...baseProps);furnishings.splice(0,furnishings.length,...baseFurnishings);
      if(density===2){props.push(...baseProps.map(p=>({...p,opts:{...p.opts},x:p.x+3,y:p.y+3})));furnishings.push(...baseFurnishings.map(p=>({...p,x:p.x+3,y:p.y+3})));}
      return {before:{props:baseProps.length,furnishings:baseFurnishings.length},props:props.length,furnishings:furnishings.length};
    }
    return {map,props,draw,benchmarkDensity,renderers:{
      bell,well,resonator,
      furniture(r,entity,state,time,visual) { furniture(r,{...visual,kind:visual.name||'table',x:entity.x,y:entity.y,z:entity.z},time); }
    }};
};
})();

/* SOURCE: src/adapters/my-3d2dge/world.js */
/* Reusable content-to-my-3D2dge adapter. Definition records are immutable;
 * state.entities owns every interactive instance's transform and state. */
(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const rect = (x,y,w,h,visit) => {
    for (let cy=y;cy<y+h;cy++) for (let cx=x;cx<x+w;cx++) visit(cx,cy);
  };

  /** Geometry is intentionally DOM-free so validation and tests use identical cells. */
  function geometry(region) {
    const width=region.width, height=region.height;
    const cells=Array(width*height).fill(0);
    const floors=Array(width*height).fill(region.defaultFloor || 'grass');
    const blocked=Array(width*height).fill(0);
    const set=(x,y,callback)=>{ if(x>=0&&y>=0&&x<width&&y<height)callback(y*width+x); };
    const floor=(r)=>rect(r.x,r.y,r.w||1,r.h||1,(x,y)=>set(x,y,i=>{
      if(r.floor)floors[i]=r.floor;
      blocked[i]=r.blocked===true ? 1 : 0;
      if(r.wall!==undefined)cells[i]=r.wall;
    }));
    const wall=(x,y,w,h,id)=>rect(x,y,w,h,(xx,yy)=>set(xx,yy,i=>cells[i]=id));
    for(const r of region.terrain||[])floor(r);
    for(const r of region.rooms||[]) {
      floor({...r,wall:undefined});
      wall(r.x,r.y,r.w,1,r.wall||1);
      wall(r.x,r.y,1,r.h,r.wall||1);
      wall(r.x,r.y+r.h-1,r.w,1,r.cutWall||2);
      wall(r.x+r.w-1,r.y,1,r.h,r.cutWall||2);
      for(const [x,y,w=1,h=1] of r.doors||[])wall(x,y,w,h,0);
    }
    for(const r of region.walls||[])wall(r.x,r.y,r.w||1,r.h||1,r.wall||1);
    for(const b of region.blocked||[])set(b.x,b.y,i=>blocked[i]=1);
    // Optional full arrays override the structured helpers. All have width*height entries.
    if(region.cells)cells.splice(0,cells.length,...region.cells);
    if(region.floors)floors.splice(0,floors.length,...region.floors);
    if(region.blockedCells)blocked.splice(0,blocked.length,...region.blockedCells);
    return {cells,floors,blocked,width,height};
  }

  function defaultArt(E,region) {
    const {cells,floors,blocked}=geometry(region);
    const stone={h:40,top:'#8f9678',side:'#7a886b',line:'#4e6554',face:'stone',roof:'slab'};
    const palette={stones:['#69756b','#778171','#7d8676','#637265'].map(E.hex),mortar:E.hex('#4c5c52'),hi:E.hex('#939983'),lo:E.hex('#596456'),speck:E.hex('#516251')};
    const map=new E.TileMap({w:region.width,h:region.height,cells,floor:floors,blocked,
      types:{1:stone,2:{...stone,cut:true,cutH:9},...(region.wallTypes||{})},ao:3,
      floorTex(x,y,tag) {
        if(tag==='water')return E.tex.water(x,y,{base:'#22575b',dark:'#1d4b52',light:'#6a9b91'});
        if(tag==='wood'||tag==='dock')return E.tex.planks(x,y,{base:'#8b6b47',dark:'#73543b',line:'#4f4435'});
        if(tag==='stone'||tag==='crypt'||tag==='chapel')return E.tex.flagstone(x,y,palette);
        if(tag==='dirt'||tag==='garden')return E.tex.dirt(x,y,{base:'#83815a',dark:'#646d49',light:'#979067'});
        return E.tex.grass(x,y,{base:'#667a4c',dark:'#475f40',light:'#7d8954',flower:'#d1a663'});
      }});
    const props=(region.props||[]).map(clone);
    return {map,props,draw(r) {
      r.sky(region.sky||['#1d3434','#46584a']);
      map.drawFloor(r);map.queueWalls(r);
      for(const p of props)if(r.visible(p.x,p.y,p.z||0,85,110,100))r.prop(p.name,p.x,p.y,p.z||0,p.opts||{});
    }};
  }

  function fallbackState(registry,region) {
    const entities={};
    for(const p of region.entities||[]) {
      const definition=registry.get('actors',p.definition)||registry.get('prefabs',p.definition);
      entities[p.id]={...clone(p),regionId:region.id,state:{...(definition?.initialState||{}),...(p.state||{})}};
    }
    return {regionId:region.id,entities,flags:{}};
  }

  function create(E,registry,state) {
    registry ||= globalThis.HBRPG?.createRegistry(globalThis.HBPacks||[]);
    if(!registry)throw new Error('World needs a content registry.');
    const regionId=state?.regionId || registry.initial?.regionId || registry.all('regions')[0]?.id;
    const region=registry.get('regions',regionId);
    if(!region)throw new Error(`World region not found: ${regionId}`);
    if((region.tileSize||16)!==16)throw new Error(`Region ${region.id}: my-3D2dge TileMap uses 16-unit tiles.`);
    state ||= fallbackState(registry,region);
    const builder=region.builder && globalThis.HBRegionBuilders?.[region.builder];
    if(region.builder&&!builder)throw new Error(`Region ${region.id}: unknown art builder ${region.builder}.`);
    const art=builder ? builder(E,region) : defaultArt(E,region);
    const map=art.map, staticBlocked=map.blocked.slice(), tileSize=16;
    const objects=[],actors=[],npcs=[],enemies=[],byId=new Map();
    let previousBlocked=new Set(),revision=0,currentState=state,benchmarkCopies=0;

    function sourceDefinition(entity) {
      return registry.get(entity.kind==='actor'?'actors':'prefabs',entity.definition)
        ||registry.get('actors',entity.definition)||registry.get('prefabs',entity.definition);
    }
    function isPresent(entity) {
      return entity.regionId===region.id && entity.state?.removed!==true && entity.state?.hidden!==true;
    }
    function colliderCells(entity,definition,x=entity.x,y=entity.y) {
      const c=definition?.collider;
      if(!c||c.enabled===false||entity.state?.collision===false)return [];
      if(c.when==='closed'&&entity.state?.open)return [];
      if(c.when==='open'&&!entity.state?.open)return [];
      const left=x+(c.offsetX||0)-(c.w||16)/2,top=y+(c.offsetY||0)-(c.h||16)/2;
      const result=[];
      for(let cy=Math.floor(top/16);cy<=Math.floor((top+(c.h||16)-.0001)/16);cy++)
        for(let cx=Math.floor(left/16);cx<=Math.floor((left+(c.w||16)-.0001)/16);cx++)result.push([cx,cy]);
      return result;
    }
    function sync(nextState) {
      currentState=nextState;
      const active=new Set(),nextBlocked=new Set();
      objects.length=actors.length=npcs.length=enemies.length=0;
      for(const entity of Object.values(nextState.entities||{})) {
        if(!isPresent(entity))continue;
        const definition=sourceDefinition(entity);
        if(!definition)continue; // Registry/save validation reports removed references before entering play.
        const actor=entity.kind==='actor'||!!registry.get('actors',entity.definition);
        let item=byId.get(entity.id);
        if(!item){item={};byId.set(entity.id,item);}
        Object.assign(item,definition,entity,{definition:entity.definition,definitionData:definition,entity,
          x:entity.x,y:entity.y,z:entity.z||0,name:entity.name||definition.name||entity.id,
          height:definition.pick?.height??24,range:definition.range??38,
          anchor:{x:entity.x+(definition.anchor?.x||0),y:entity.y+(definition.anchor?.y||0)},
          facing:entity.state?.facing??0,pick:definition.pick||{}});
        active.add(entity.id);
        if(actor){actors.push(item);(definition.team==='hostile'?enemies:npcs).push(item);}else objects.push(item);
        for(const [cx,cy] of colliderCells(entity,definition))if(cx>=0&&cy>=0&&cx<region.width&&cy<region.height)nextBlocked.add(cy*region.width+cx);
      }
      for(const id of byId.keys())if(!active.has(id))byId.delete(id);
      const touched=new Set([...previousBlocked,...nextBlocked]);
      let changed=false;
      for(const index of touched) {
        const value=!!(staticBlocked[index]||nextBlocked.has(index));
        if(!!map.blocked[index]!==value){map.block(index%region.width,Math.floor(index/region.width),value);changed=true;}
      }
      if(benchmarkCopies)for(const item of objects.slice())objects.push({...item,id:item.id+'-benchmark',x:item.x+3,y:item.y+3});
      previousBlocked=nextBlocked;
      if(changed)revision++;
      return revision;
    }

    /** Collider queries include unchanged terrain plus all other current entities. */
    function canPlace(entityOrId,x,y,queryState=currentState) {
      if(!Number.isFinite(x)||!Number.isFinite(y))return false;
      const entity=entityOrId==='player'?{id:'player',...queryState.player,regionId:queryState.regionId}:typeof entityOrId==='string'?queryState.entities?.[entityOrId]:entityOrId;
      if(!entity)return false;
      const definition=sourceDefinition(entity),cells=colliderCells(entity,definition,x,y);
      const radius=definition?.stats?.radius??4;
      if(!cells.length) {
        for(const [dx,dy] of [[0,0],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]])cells.push([Math.floor((x+dx)/16),Math.floor((y+dy)/16)]);
      }
      const occupied=new Set();
      for(const other of Object.values(queryState.entities||{}))if(other.id!==entity.id&&isPresent(other))
        for(const [cx,cy] of colliderCells(other,sourceDefinition(other)))occupied.add(cy*region.width+cx);
      return cells.every(([cx,cy])=>cx>=0&&cy>=0&&cx<region.width&&cy<region.height
        &&!map.cells[cy*region.width+cx]&&!staticBlocked[cy*region.width+cx]&&!occupied.has(cy*region.width+cx));
    }
    function lineOfSight(a,b) {
      const length=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.ceil(length/4);
      const target=b.id&&(b.definition?b:currentState.entities?.[b.id]);
      const endCells=new Set(target?colliderCells(target,sourceDefinition(target)).map(([cx,cy])=>cy*region.width+cx):[]);
      for(let n=1;n<steps;n++) {
        const t=n/steps,cx=Math.floor((a.x+(b.x-a.x)*t)/16),cy=Math.floor((a.y+(b.y-a.y)*t)/16),i=cy*region.width+cx;
        if(cx<0||cy<0||cx>=region.width||cy>=region.height||map.cells[i]||staticBlocked[i]||(map.blocked[i]&&!endCells.has(i)))return false;
      }
      return true;
    }
    function drawGate(r,item,visual) {
      if(item.state?.open)return;
      const x=item.x,y=item.y,z=item.z||0,h=visual.height||38,w=visual.width||32;
      const horizontal=visual.orientation==='horizontal';
      r.queue(x,y,z,g=>{
        for(let offset=-w/2+2;offset<=w/2;offset+=4.5){
          const xx=x+(horizontal?offset:0),yy=y+(horizontal?0:offset);
          r.box(g,xx-1.5,yy-1,z,xx+1.5,yy+1,z+h,visual.color||'#97a589','#4e6860');
        }
        for(const zz of [8,h-10])r.box(g,x-(horizontal?w/2:2),y-(horizontal?2:w/2),z+zz,x+(horizontal?w/2:2),y+(horizontal?2:w/2),z+zz+3,'#b3aa7c','#6f795d');
        const p=r.w(x-1,y,z+h*.55);E.px.disc(g,p[0],p[1],3,'#c6ab66');
      },{hides:true,solid:true});
    }
    function drawEntity(r,item,time) {
      const visual=item.visual||{kind:'prop',name:'crate'};
      if(!r.visible(item.x,item.y,item.z||0,90,120,100))return;
      const extension=registry.extensions?.renderers?.[visual.kind];
      if(extension){extension({renderer:r,entity:item.entity,definition:item.definitionData,state:currentState,registry,time,visual,engine:E},visual);return;}
      const renderer=art.renderers?.[visual.kind]||globalThis.HBVisualRenderers?.[visual.kind];
      if(renderer){renderer(r,item,currentState,time,visual,E);return;}
      if(visual.kind==='gate'){drawGate(r,item,visual);return;}
      if(visual.kind==='marker')return;
      if(visual.kind==='image') {
        const image=images.get(visual.asset);
        if(image?.complete&&image.naturalWidth)r.queue(item.x,item.y,item.z||0,g=>{
          const p=r.w(item.x,item.y,item.z||0),s=visual.scale||1;
          g.drawImage(image,p[0]-image.width*s/2,p[1]-image.height*s,image.width*s,image.height*s);
        });
        return;
      }
      r.prop(visual.name||'crate',item.x,item.y,item.z||0,{...visual,...visual.opts,open:!!item.state?.open});
    }
    const images=new Map();
    if(typeof Image!=='undefined')for(const asset of registry.all('assets'))if(asset.type==='image'&&asset.src){const image=new Image();image.src=asset.src;images.set(asset.id,image);}
    const landmarks=clone(region.landmarks||[]);
    function location(x,y) {
      for(const l of landmarks)if(l.bounds){const [bx,by,w,h]=l.bounds;if(x>=bx*16&&y>=by*16&&x<(bx+w)*16&&y<(by+h)*16)return l.name;}
      return region.name||region.id;
    }
    function draw(r,nextState,time=0) {
      currentState=nextState||currentState;
      art.draw(r,currentState,time);
      for(const object of objects)drawEntity(r,object,time);
    }
    function benchmarkDensity(density=1) {
      if(density!==1&&density!==2)throw new Error('Benchmark density must be 1 or 2.');
      const artCounts=art.benchmarkDensity?.(density)||{before:{props:art.props?.length||0,furnishings:0},props:art.props?.length||0,furnishings:0};
      const count=Object.values(currentState.entities||{}).filter(e=>isPresent(e)&&!registry.get('actors',e.definition)).length;
      const furnitureCount=objects.filter(o=>o.visual?.kind==='furniture'&&!o.id.endsWith('-benchmark')).length;
      benchmarkCopies=density===2?1:0;
      sync(currentState);
      return {before:{...artCounts.before,furnishings:artCounts.before.furnishings+furnitureCount,interactiveEntities:count},props:artCounts.props,furnishings:artCounts.furnishings+furnitureCount*density,interactiveEntities:objects.length};
    }
    sync(state);
    return {map,props:art.props||[],actors,npcs,enemies,objects,spawn:clone(region.spawn),region,regionId:region.id,
      width:region.width*tileSize,height:region.height*tileSize,landmarks,draw,sync,location,canPlace,lineOfSight,benchmarkDensity,
      drawPreview(r,definition,options={}) { const item={...definition,id:'preview',definitionData:definition,x:0,y:0,z:0,state:{...(definition.initialState||{}),open:!!options.open}}; item.entity=item;drawEntity(r,item,options.time||0); },
      entity:id=>byId.get(id),get navRevision(){return revision;},dispose(){images.clear();byId.clear();objects.length=actors.length=npcs.length=enemies.length=0;}};
  }
  /** DOM-free destination check, also valid before switching regions. */
  function canPlace(registry,state,target,x,y,regionId) {
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    const entity=target==='player'?{id:'player',...state.player,regionId:state.regionId}:typeof target==='string'?state.entities?.[target]:target;
    if(!entity)return false;
    const region=registry.get('regions',regionId||entity.regionId||state.regionId);
    if(!region)return false;
    const {cells,blocked}=geometry(region);
    const definition=e=>registry.get('actors',e.definition)||registry.get('prefabs',e.definition);
    const footprint=(e,xx=e.x,yy=e.y)=>{
      const d=definition(e),c=d?.collider;
      if(!c||c.enabled===false||e.state?.collision===false||(c.when==='closed'&&e.state?.open)||(c.when==='open'&&!e.state?.open))return [];
      const left=xx+(c.offsetX||0)-(c.w||16)/2,top=yy+(c.offsetY||0)-(c.h||16)/2,result=[];
      for(let cy=Math.floor(top/16);cy<=Math.floor((top+(c.h||16)-.0001)/16);cy++)for(let cx=Math.floor(left/16);cx<=Math.floor((left+(c.w||16)-.0001)/16);cx++)result.push([cx,cy]);
      return result;
    };
    const points=footprint(entity,x,y),d=definition(entity),radius=d?.stats?.radius??4;
    if(!points.length)for(const [dx,dy] of [[0,0],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]])points.push([Math.floor((x+dx)/16),Math.floor((y+dy)/16)]);
    const occupied=new Set();
    for(const other of Object.values(state.entities||{}))if(other.id!==entity.id&&other.regionId===region.id&&!other.state?.hidden&&!other.state?.removed)for(const [cx,cy] of footprint(other))occupied.add(cy*region.width+cx);
    return points.every(([cx,cy])=>cx>=0&&cy>=0&&cx<region.width&&cy<region.height&&!cells[cy*region.width+cx]&&!blocked[cy*region.width+cx]&&!occupied.has(cy*region.width+cx));
  }

  const previewContexts=new WeakMap();
  /** Isolated public Renderer/Lighting/Humanoid preview. No Game, audio or input loop is created. */
  function preview(E,canvas,definition,options={}) {
    let previewGame=previewContexts.get(canvas);
    if(!previewGame) {
      const ctx=canvas.getContext('2d');
      const screen={ctx,buf:canvas,W:canvas.width,H:canvas.height,ix:0,iy:0,
        begin(cx,cy,bg){this.W=canvas.width;this.H=canvas.height;this.ix=cx-this.W/2;this.iy=cy-this.H*.76;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=bg;ctx.fillRect(0,0,this.W,this.H);ctx.imageSmoothingEnabled=false;},present(){}};
      previewGame={screen,view:new E.View('preview','Preview',45,30,2,1),o:{bg:'#1c322d'},stats:{},time:0,real:0,particles:{draw(){}},reduceMotion:false};
      previewGame.lights=new E.Lighting(previewGame);previewGame.renderer=new E.Renderer(previewGame);previewContexts.set(canvas,previewGame);
    }
    const game=previewGame,r=game.renderer,scale=Number(options.scale)||2,time=Number(options.time)||0,dt=Math.max(1/120,Math.min(.05,time-game.real||1/30));
    game.view.set(45,30,scale,1);game.view.zoom=scale;game.time=game.real=time;
    game.lights.clear();game.lights.enabled=String(options.lighting).toLowerCase()==='dynamic';game.lights.ambient=.5;
    r.glowMask=false;r.begin(0,0);game.lights.add(-22,-20,35,110,1);
    r.decal(()=>{r.groundRing(0,0,22,'#516f61',.65);r.groundRing(0,0,34,'#3b574d',.45);});
    if(options.kind==='actor'||definition.appearance) {
      if(game.characterDefinition!==definition){game.character=new E.Humanoid({...definition.appearance});game.characterDefinition=definition;game.attack=new E.Attack(definition.attack?.pose||definition.attack?.animation||'slash');}
      const character=game.character,pose=options.pose||'idle',moving=pose==='walk'||pose==='run',facing=(Number(options.facing)||0)*Math.PI/180;
      if(pose==='attack'&&!game.attack.busy)game.attack.start();game.attack.update(dt);
      character.update(dt,{x:0,y:0,z:0,facing,run:moving?(pose==='run'?1:.55):0,pose:pose==='idle'||moving||pose==='attack'?undefined:pose,attack:pose==='attack'?game.attack.state:null});
      r.shadow(0,0,6,.25);r.actor(0,0,0,(g,x,y)=>character.draw(g,x,y,game.view));
    }else if(options.world?.drawPreview)options.world.drawPreview(r,definition,options);
    else r.prop(definition.visual?.name||'crate',0,0,0,{...definition.visual,open:!!options.open});
    if(options.bounds)r.overlay(g=>{
      const c=definition.collider||{w:16,h:16},height=definition.pick?.height||32;
      const points=[[-c.w/2,-c.h/2],[c.w/2,-c.h/2],[c.w/2,c.h/2],[-c.w/2,c.h/2]];
      for(let n=0;n<4;n++){const a=points[n],b=points[(n+1)%4],pa=r.w(a[0],a[1],0),pb=r.w(b[0],b[1],0),ta=r.w(a[0],a[1],height),tb=r.w(b[0],b[1],height);E.px.line(g,...pa,...pb,'#efbc73');E.px.line(g,...ta,...tb,'#8bc7bd');E.px.line(g,...pa,...ta,'#8bc7bd');}
    });
    r.finish();
    return {width:canvas.width,height:canvas.height,actors:game.stats.actors,drawnItems:game.stats.items,lighting:game.lights.enabled?'Dynamic':'Soft'};
  }
  globalThis.HBWorld={create,geometry,canPlace,preview};
})();
