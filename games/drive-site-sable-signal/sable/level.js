/* THE RELAY. One authored floor. Coordinates are world units; one tile is 16 units. */
(function (E) {
  'use strict';
  const T = 16, W = 60, H = 46;
  const rooms = [
    {id:'dock',name:'LOADING DOCK',x:5,y:30,w:18,h:11,color:'#465357'},
    {id:'reception',name:'RECEPTION',x:5,y:18,w:18,h:11,color:'#576164'},
    {id:'lounge',name:'STAFF LOUNGE',x:5,y:5,w:18,h:12,color:'#413b50'},
    {id:'spine',name:'SERVICE CORRIDOR',x:24,y:5,w:7,h:36,color:'#2d444c'},
    {id:'archive',name:'TAPE ARCHIVE',x:32,y:30,w:23,h:11,color:'#4e4c40'},
    {id:'studio',name:'STUDIO A',x:32,y:18,w:23,h:11,color:'#4b3b4a'},
    {id:'control',name:'CONTROL ROOM',x:32,y:5,w:23,h:12,color:'#394f5a'}
  ];
  const enemySpawns = [
    {x:208,y:608,angle:-Math.PI/2,weapon:'baton',label:'Dock guard'},
    {x:304,y:552,angle:Math.PI,weapon:'baton',label:'Dock patrol',path:[[304,552],[176,536]]},
    {x:160,y:384,angle:Math.PI/2,weapon:'pistol',label:'Reception guard'},
    {x:304,y:336,angle:Math.PI/2,weapon:'baton',label:'Reception patrol',path:[[304,336],[304,416]]},
    {x:304,y:200,angle:Math.PI,weapon:'shotgun',label:'Lounge gunner'},
    {x:152,y:128,angle:0,weapon:'pistol',label:'Lounge patrol',path:[[152,128],[280,128],[280,224],[152,224]]},
    {x:424,y:440,angle:-Math.PI/2,weapon:'baton',label:'Corridor runner',runner:true,path:[[424,440],[424,296]]},
    {x:472,y:144,angle:Math.PI/2,weapon:'pistol',label:'Corridor guard'},
    {x:616,y:568,angle:Math.PI/2,weapon:'pistol',label:'Archive guard'},
    {x:808,y:568,angle:Math.PI,weapon:'baton',label:'Archive patrol',path:[[808,568],[712,568],[712,624]]},
    {x:760,y:400,angle:Math.PI,weapon:'shotgun',label:'Studio gunner'},
    {x:608,y:328,angle:0,weapon:'baton',label:'Studio patrol',path:[[608,328],[680,328],[680,416]]},
    {x:824,y:328,angle:Math.PI/2,weapon:'pistol',label:'Studio guard'},
    {x:600,y:168,angle:Math.PI/2,weapon:'pistol',label:'Control guard'},
    {x:792,y:224,angle:Math.PI,weapon:'shotgun',label:'Control gunner'},
    {x:840,y:120,angle:Math.PI/2,weapon:'pistol',label:'Network chief',elite:true}
  ];
  const propSpecs = [
    ['crate',112,520,32,32],['crate',128,600,32,32],['crate',304,632,32,16],['crate',336,512,16,32],
    ['shelf',88,552,16,32],['lamp',336,624,0,0],
    ['desk',112,320,64,32],['chair',128,360,16,16],['sofa',112,432,64,16],['plant',336,440,16,16],['vending',336,312,16,32],
    ['sofa',112,176,16,48],['sofa',176,240,64,16],['table',184,176,32,32],['plant',336,104,16,16],['vending',96,104,16,32],
    ['rack',544,512,32,32],['rack',688,512,32,32],['rack',800,512,32,32],['shelf',560,608,64,16],['tape',816,632,32,16],
    ['console',552,384,32,48],['speaker',544,312,16,32],['speaker',856,440,16,16],['table',736,320,32,32],['mic',704,376,0,0],['rug',720,376,64,64],
    ['console',704,96,112,32],['console',528,96,48,32],['rack',528,224,32,32],['rack',592,224,32,32],['chair',736,144,16,16],['plant',864,240,16,16],
    ['rack',480,304,16,48],['lamp',400,192,0,0],['lamp',400,512,0,0],['van',112,688,64,32]
  ];
  function roomAt(x, y) { return rooms.find(r => x >= r.x*T && y >= r.y*T && x < (r.x+r.w)*T && y < (r.y+r.h)*T); }
  function build() {
    const cells = new Array(W*H).fill(0);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(x===0||y===0||x===W-1||y===H-1||(x>=4&&x<=55&&y>=4&&y<=41))cells[y*W+x]=1;
    for(const r of rooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)cells[y*W+x]=0;
    const doors=[];
    function door(x,y,vertical=false,name='Door') {
      const points=vertical?[[x,y],[x,y+1]]:[[x,y],[x+1,y]];
      for(const [cx,cy]of points)cells[cy*W+cx]=0;
      doors.push({id:doors.length,x:(x+(vertical?.5:1))*T,y:(y+(vertical?1:.5))*T,vertical,points,open:false,angle:0,swing:1,name});
    }
    door(12,41,false,'Dock entry');door(12,29,false,'Reception door');door(12,17,false,'Lounge door');
    door(23,35,true,'Dock service door');door(23,22,true,'Reception service door');door(23,10,true,'Lounge service door');
    door(31,35,true,'Archive door');door(31,22,true,'Studio door');door(31,9,true,'Control door');
    door(43,29,false,'Archive studio door');door(43,17,false,'Studio control door');
    const map=new E.TileMap({w:W,h:H,cells,tile:T,ao:4,shimmer:false,cutaway:false,types:{1:{h:18,top:'#68808a',side:'#263944',sideLt:'#425966',line:'#12232e',face:'plaster',roof:'plain',texture:false}},floorTex:floorColor});
    const props=propSpecs.map((a,id)=>({id,kind:a[0],x:a[1],y:a[2],w:a[3],h:a[4]}));
    for(const p of props)if(!['rug','lamp','mic','van'].includes(p.kind))for(let cy=Math.floor(p.y/T);cy<Math.ceil((p.y+p.h)/T);cy++)for(let cx=Math.floor(p.x/T);cx<Math.ceil((p.x+p.w)/T);cx++)map.block(cx,cy,true);
    const doorCells=new Set();for(const d of doors)for(const [cx,cy]of d.points){doorCells.add(cy*W+cx);map.block(cx,cy,true);}
    // Guards can plan through a door because they can push it open. Furniture remains solid.
    const navigation={w:W,h:H,T,cell:(x,y)=>map.cell(x,y),get version(){return map.version;},get navVersion(){return map.navVersion;},walkable:(x,y)=>map.cell(x,y)===0&&(!map.blocked[y*W+x]||doorCells.has(y*W+x))};
    return {map,navigation,doors,props,rooms,enemySpawns,spawn:{x:208,y:704},tape:{x:832,y:611},terminal:{x:782,y:149},exit:{x:208,y:704}};
  }
  function floorColor(x,y) {
    const room=roomAt(x,y), ix=Math.floor(x),iy=Math.floor(y),n=E.hash2(ix,iy);
    let c;
    if(!room){const wet=(iy%37<2&&E.hash2(Math.floor(ix/14),Math.floor(iy/37))>.52);c=wet?[35,58,69]:[20,32,42];if(y>678&&y<727&&((ix%128<3)||(iy===684||iy===726)))c=[113,102,68];}
    else if(room.id==='dock'){const edge=ix%48<1||iy%48<1;c=edge?[41,52,57]:[69,81,82];if(y>624&&y<637&&x<320&&x>160)c=(Math.floor((x+y)/8)%2)?[182,139,67]:[42,47,43];}
    else if(room.id==='reception'){const check=(Math.floor(x/24)+Math.floor(y/24))%2;c=check?[83,96,98]:[62,78,84];if(ix%24<1||iy%24<1)c=[39,56,64];}
    else if(room.id==='lounge'){const diamond=Math.abs(ix%24-12)+Math.abs(iy%24-12);c=diamond<3?[104,72,84]:diamond<5?[65,54,69]:[47,43,59];}
    else if(room.id==='spine'){c=ix%16<1||iy%32<1?[28,43,49]:[46,66,73];if(Math.abs(x-440)<1.4)c=[61,104,113];if(iy%112<8&&Math.abs(x-440)<8)c=[84,135,145];}
    else if(room.id==='archive'){const band=Math.floor(y/10);c=(band%3===0)?[87,80,65]:[74,71,62];if(iy%10===0||(ix+band*32)%96===0)c=[49,53,50];}
    else if(room.id==='studio'){c=(ix+iy)%20<2?[91,65,82]:[58,42,59];if(x>696&&x<814&&y>350&&y<440)c=ix%28<2||iy%28<2?[88,60,72]:[66,46,65];}
    else{c=ix%32<1||iy%32<1?[37,59,70]:[60,81,94];if(iy%32===2)c=[70,93,104];}
    const v=n<.07?-5:n>.93?5:0;return[c[0]+v,c[1]+v,c[2]+v];
  }
  function flat(r,g,x,y,w,h,z,color){E.px.poly(g,[r.w(x,y,z),r.w(x+w,y,z),r.w(x+w,y+h,z),r.w(x,y+h,z)],color);}
  function line(r,g,x,y,x2,y2,z,color,width=1){const a=r.w(x,y,z),b=r.w(x2,y2,z);E.px.line(g,a[0],a[1],b[0],b[1],color,width);}
  function disc(r,g,x,y,z,rad,color){const p=r.w(x,y,z);E.px.disc(g,p[0],p[1],rad*r.view.scale,color);}
  function drawProp(r,p,time) {
    const {x,y,w,h,kind:k}=p, midx=x+w/2,midy=y+h/2;
    if(!r.visible(midx,midy,0,160,100,100))return;
    if(k==='rug'){r.decal(g=>{flat(r,g,x-14,y-10,w+22,h+15,0,'#27202f');for(let i=0;i<3;i++){flat(r,g,x-12+i*3,y-8+i*3,w+18-i*6,1,0,'#99705e');flat(r,g,x-12+i*3,y+h+2-i*3,w+18-i*6,1,0,'#99705e');}});return;}
    r.queue(midx,midy,0,g=>{
      const box=(xx,yy,ww,hh,z,top,side='#1b2b35',z0=0)=>r.box(g,xx,yy,z0,xx+ww,yy+hh,z,top,side);
      if(k==='crate'){
        box(x,y,w,h,12,'#8b7759','#5b5143');box(x+2,y+2,w-4,h-4,13,'#a8936c','#61513c');
        line(r,g,x+4,y+4,x+w-4,y+h-4,13,'#665b49',2);line(r,g,x+w-4,y+4,x+4,y+h-4,13,'#665b49',2);
        flat(r,g,x+w/2-5,y+h/2-3,10,6,13.5,'#d0bea1');
      }else if(k==='sofa'){
        box(x,y,w,h,7,'#292f3d','#17202b');const vertical=h>w;
        box(x+2,y+2,w-4,h-4,11,'#87554e','#583e3b');
        if(vertical){box(x,y,5,h,17,'#a3695c','#573e3e');for(let yy=y+17;yy<y+h;yy+=16)line(r,g,x+6,yy,x+w-3,yy,11,'#553d3b');}
        else{box(x,y,w,5,17,'#a3695c','#573e3e');for(let xx=x+17;xx<x+w;xx+=16)line(r,g,xx,y+6,xx,y+h-3,11,'#553d3b');}
      }else if(k==='desk'||k==='table'){
        box(x+3,y+3,3,h-6,9,'#18272f');box(x+w-6,y+3,3,h-6,9,'#18272f');box(x,y,w,h,12,k==='desk'?'#948e76':'#6d6762','#3d4547');
        if(k==='desk'){box(x+8,y+3,19,12,22,'#2e3a46','#111f2a');flat(r,g,x+10,y+13,15,2,21,'#79d6d2');flat(r,g,x+8,y+19,19,7,12.4,'#303f46');for(let i=0;i<8;i++)flat(r,g,x+10+i*2,y+20,1,4,12.7,'#819391');flat(r,g,x+w-17,y+15,9,12,12.4,'#d7cfac');}
        else{flat(r,g,x+7,y+7,12,9,12.5,'#cbb89a');disc(r,g,x+w-8,y+h-8,13,3,'#252e34');disc(r,g,x+w-8,y+h-8,13.1,1.7,'#cfae7c');}
      }else if(k==='chair'){
        box(x+5,y+4,6,8,5,'#2b383c');box(x+1,y+2,14,12,9,'#51767a','#263e45');box(x+1,y+10,14,5,17,'#6b9190','#304c53');
      }else if(k==='rack'||k==='shelf'||k==='tape'){
        box(x,y,w,h,k==='rack'?26:16,'#364751','#1c303c');const z=k==='rack'?26:16;
        for(let yy=y+3;yy<y+h-2;yy+=7){flat(r,g,x+3,yy,w-6,5,z+.1,'#111e29');for(let xx=x+5;xx<x+w-4;xx+=5){flat(r,g,xx,yy+1,3,3,z+.4,((xx+yy)%3)?'#a59f83':'#d0ab71');}}
        if(k==='rack'){for(let i=0;i<3;i++)disc(r,g,x+w-4,y+4+i*5,z+1,.65,Math.floor(time*2+p.id)%3===i?'#71e6cc':'#477b82');}
        if(k==='tape'){flat(r,g,x+9,y+4,14,9,z+1,'#ddb06a');disc(r,g,x+13,y+8,z+1.1,1.5,'#273743');disc(r,g,x+19,y+8,z+1.1,1.5,'#273743');}
      }else if(k==='console'){
        box(x,y,w,h,15,'#5d777e','#263d49');
        const horizontal=w>h;
        for(let a=3;a<(horizontal?w:h)-14;a+=22){const xx=horizontal?x+a:x+3,yy=horizontal?y+3:y+a;box(xx,yy,17,10,23,'#273e4a','#142734');flat(r,g,xx+2,yy+8,13,1.4,23.1,'#84e3d4');for(let j=0;j<5;j++){flat(r,g,xx+2+j*3,yy+13,1,8,15.2,'#243c49');flat(r,g,xx+2+j*3,yy+14+(j*3+p.id)%5,2,2,15.5,j%2?'#cbd5b5':'#e5b766');}}
      }else if(k==='speaker'){
        box(x,y,w,h,25,'#26323c','#101d28');disc(r,g,x+w/2,y+h*.33,25.1,5,'#141c25');disc(r,g,x+w/2,y+h*.7,25.1,5,'#141c25');disc(r,g,x+w/2,y+h*.7,25.2,2,'#44515b');
      }else if(k==='plant'){
        box(x+3,y+3,10,10,9,'#ba8461','#6a4d43');for(let i=0;i<7;i++){const a=i*2.4;disc(r,g,x+8+Math.cos(a)*5,y+8+Math.sin(a)*5,17+(i%3),3.3,i%2?'#467c70':'#6b9780');}
      }else if(k==='vending'){
        box(x,y,w,h,29,'#839194','#3d535e');flat(r,g,x+2,y+3,w-4,h-7,29.2,'#173842');for(let i=0;i<4;i++){flat(r,g,x+3,y+5+i*5,8,3,29.3,['#dcab6a','#79b5bd','#a16669','#a4beb8'][i]);}flat(r,g,x+3,y+h-5,7,2,29.4,'#111e2a');
      }else if(k==='lamp'){
        disc(r,g,x,y,0,5,'#182b36');disc(r,g,x,y,24,6,'#e5c07f');disc(r,g,x,y,26,3,'#fff0b3');
      }else if(k==='mic'){
        disc(r,g,x,y,0,5,'#1a2330');line(r,g,x,y,x,y-2,22,'#8b9ea4',2);line(r,g,x,y-2,x+8,y-2,24,'#9caeb1',2);disc(r,g,x+8,y-2,24,2,'#263944');
      }else if(k==='van'){
        box(x-2,y+3,w+4,h-6,6,'#151d27');box(x,y,w,h,17,'#596c72','#2d4350');box(x+5,y+3,w-22,h-6,21,'#acb6b1','#61737a');flat(r,g,x+w-19,y+4,11,h-8,19,'#152c3b');line(r,g,x+30,y+4,x+30,y+h-4,21.4,'#758989');flat(r,g,x+w-3,y+2,2,5,15,'#f5d493');flat(r,g,x+w-3,y+h-7,2,5,15,'#f5d493');flat(r,g,x+1,y+2,2,4,15,'#d57057');flat(r,g,x+1,y+h-6,2,4,15,'#d57057');
      }
    },{solid:true});
  }
  function drawDoor(r,d) {
    r.queue(d.x,d.y,0,g=>{
      const a=d.vertical?Math.PI/2:0,angle=a+d.angle*d.swing;
      const hx=d.x-Math.cos(a)*16,hy=d.y-Math.sin(a)*16;
      const dx=Math.cos(angle)*32,dy=Math.sin(angle)*32,nx=-Math.sin(angle)*2,ny=Math.cos(angle)*2;
      const pts=[[hx+nx,hy+ny],[hx+dx+nx,hy+dy+ny],[hx+dx-nx,hy+dy-ny],[hx-nx,hy-ny]];
      E.px.poly(g,pts.map(p=>r.w(p[0],p[1],10)),d.open?'#9a8060':'#c39c68');
      line(r,g,hx,hy,hx+dx,hy+dy,12,'#f0c783',2);disc(r,g,hx+dx*.82,hy+dy*.82,13,1.5,'#18232d');
    },{solid:true});
  }
  function draw(r,level,state) {
    level.map.drawFloor(r);
    // Floor graphics are decals, so walls and actors cover them correctly.
    r.decal(g=>{
      for(const room of rooms){const [sx,sy]=r.w((room.x+1)*T,(room.y+room.h-1)*T,0);if(sx>-200&&sx<r.W+40&&sy>-20&&sy<r.H+30)E.font.text(g,room.name,sx,sy,'#91a7a2',{outline:false,shadow:false,font:'tiny'});}
      const [tx,ty]=r.w(208,682,0);E.font.text(g,'03  /  SERVICE',tx-43,ty,'#c0a775',{outline:false,shadow:false,font:'tiny'});
      for(let i=0;i<4;i++){flat(r,g,80+i*176,675,90,1,0,'#42616b');}
      flat(r,g,524,280,346,2,0,'#bf7157');flat(r,g,80,280,288,2,0,'#6ab7b9');
    });
    level.map.queueWalls(r);
    for(const p of level.props)drawProp(r,p,state.t||0);
    for(const d of level.doors)drawDoor(r,d);
    // Long window bands and small signs give each room a clear identity.
    r.queue(760,78,1,g=>{line(r,g,560,79,848,79,20,'#7bd4d7',2);for(let x=560;x<848;x+=32)line(r,g,x,76,x,82,21,'#1a3341',2);});
    r.queue(704,283,1,g=>{const [x,y]=r.w(704,283,19);E.px.rect(g,x-27,y-6,54,12,'#192634');E.font.text(g,state.broadcast?'OFF AIR':'ON AIR',x,y-3,state.broadcast?'#7bd3cc':'#ff886c',{align:'center',outline:false,shadow:false});},{emissive:true});
    for(const [x,y,c]of[[224,564,'#f3c080'],[224,372,'#b4d6d2'],[220,170,'#e2a97d'],[440,390,'#77c6d3'],[440,148,'#77c6d3'],[684,570,'#e9c78e'],[736,372,'#db8c91'],[752,160,'#99d9df']]){
      if(r.visible(x,y,0,240,220,220))r.game.lights.add(x,y,38,150,.9,{color:c});
    }
    for(const p of level.props)if(p.kind==='lamp'&&r.visible(p.x,p.y,0,150))r.game.lights.add(p.x,p.y,32,90,.5,{color:'#ffce87'});
    r.game.lights.add(state.player?.x||208,state.player?.y||704,26,95,.55,{color:'#b1dce2'});
  }
  function drawMap(canvas,level,state,brief=false) {
    const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    g.fillStyle='#08141e';g.fillRect(0,0,w,h);const scale=Math.min((w-36)/960,(h-30)/736),ox=(w-960*scale)/2,oy=(h-736*scale)/2;
    const rect=(x,y,ww,hh,c)=>{g.fillStyle=c;g.fillRect(ox+x*scale,oy+y*scale,ww*scale,hh*scale);};
    for(const room of rooms){rect(room.x*T,room.y*T,room.w*T,room.h*T,room.color);g.fillStyle='#b2c4cd';g.font=(brief?8:12)+'px monospace';g.textAlign='center';g.fillText(brief?room.id.toUpperCase():room.name,ox+(room.x+room.w/2)*T*scale,oy+(room.y+room.h/2)*T*scale);}
    for(const d of level.doors)rect(d.x-(d.vertical?4:16),d.y-(d.vertical?16:4),d.vertical?8:32,d.vertical?32:8,d.open?'#7899a0':'#e1b06a');
    const marker=(x,y,c,size=7)=>{g.fillStyle=c;g.fillRect(ox+x*scale-size/2,oy+y*scale-size/2,size,size);};
    marker(level.tape.x,level.tape.y,state?.tape?'#426862':'#73dee0');marker(level.terminal.x,level.terminal.y,state?.broadcast?'#426862':'#73dee0');marker(level.exit.x,level.exit.y,'#edb969');
    if(!brief&&state){for(const e of state.enemies)if(e.alive)marker(e.x,e.y,'#ff746c',5);marker(state.player.x,state.player.y,'#ffdd92',9);}
    g.fillStyle='#6e8f9e';g.font=(brief?8:11)+'px monospace';g.textAlign='left';g.fillText('N',w-21,20);g.fillText('ENTRY',ox+228*scale,oy+711*scale);
  }
  window.SableLevel={build,draw,drawMap,drawDoor,drawProp,roomAt,rooms,enemySpawns,flat,line,disc,W,H,T};
})(My3D2dge);
