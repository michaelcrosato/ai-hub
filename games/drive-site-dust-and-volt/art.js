/* Original game art and music for Dust & Volt. All raster sources are local. */
(() => {
  'use strict';
  const E = My3D2dge, p = E.px;
  const A = window.DustArt = { ready: false, images: {}, palettes: {} };
  const imageLoad = (name, src) => new Promise(resolve => {
    const im = new Image(); im.onload = () => { A.images[name] = im; resolve(true); };
    im.onerror = () => resolve(false); im.src = src;
  });
  A.loaded = Promise.all([imageLoad('depot','assets/copperline-junction.png'),imageLoad('rook','assets/rook-courier.png'),imageLoad('tithe','assets/iron-tithe.png')]).then(ok => { A.ready = ok.every(Boolean); return A.ready; });
  const base = [
    '.........oooooo.........',
    '........oddddddo........',
    '.......odDDDDDDdo.......',
    '.......odDHHHDDdo.......',
    '.....oooddddddddooo.....',
    '....oddHHHHHHHHHdddo....',
    '.....ooooSSSSSSoooo.....',
    '........osLSLSo.........',
    '........oSSsSso.........',
    '.........ossoo..........',
    '.......ooCTTTCoo........',
    '......ocCCTTCCCCo.......',
    '.....ocCCCTCCCCCco......',
    '....ocCCCLLCCCCCCco.....',
    '....ocCCoLoCCCLCCco.....',
    '....ocCooCoCCCooCco.....',
    '....osSoCCoCCCoSso......',
    '.....ossGGGGGGssGo......',
    '......oGHHGGGGGGGGGGo...',
    '......ooGooCCCoGGHHGoo..',
    '.......ocBBbBBBCoooo....',
    '.......occCCCCCco.......',
    '.......ocCCoCCCco.......',
    '......ocCCPoPCCco.......',
    '......ocCPPopPCCco......',
    '......ocPPooopPCco......',
    '.......oPPo.oPPPo.......',
    '.......oPPo..oPPo.......',
    '.......oPPo..oPPo.......',
    '......obBBo..obBBo......',
    '.....obBBBo..obBBBbo....',
    '.....oooooo..ooooooo....'
  ];
  const common={o:'#07151d',d:'#31434b',D:'#607176',H:'#b8ba9e',S:'#c79467',s:'#765747',L:'#a1f0d7',T:'#d6a34a',C:'#914d39',c:'#4c3032',G:'#54666b',B:'#665146',b:'#b58b58',P:'#283a46',p:'#486471'};
  A.sprites={};
  for(const [kind,replace] of Object.entries({gunner:{},sniper:{C:'#675275',c:'#363047',T:'#a2cab7',d:'#2b383f',D:'#445c68',H:'#c2aaa2'},heavy:{C:'#416776',c:'#29404e',T:'#dd793f',D:'#769191',H:'#c9d4ae',S:'#5c7e87',s:'#26444f'}})) {
    A.palettes[kind]={...common,...replace}; A.sprites[kind]=E.sprite(base,A.palettes[kind],1);
  }
  A.crate=E.sprite([
    '..oooooooooooooooooooo..',
    '.oHHHHHHHHHHHHHHHHHHHHo.',
    'oHBBBBBBBBBBBBBBBBBBBBHo',
    'oHhBBbbBBBBBBBBbbBBBhBHo',
    'oHbHBbbBBBBBBBBbbBBHhbHo',
    'oHbbHBbBBBBBBBBbBBHhbbHo',
    'oHbbbHBbbbbbbbbbbHhbbbHo',
    'oHbbbbHBBBBBBBBBHhbbbbHo',
    'oHbbbbbHBBBBBBBHhbbbbbHo',
    'oHbbbbbBHBBBBBHhbbbbbbHo',
    'oHbbbbbbbHHHHHhbbbbbbbHo',
    'oHbbbbbbBHhhhHHbbbbbbbHo',
    'oHbbbbbbHhBBBBBHbbbbbbHo',
    'oHbbbbbHhBBBBBBBHbbbbbHo',
    'oHbbbbHhBBBBBBBBBHbbbbHo',
    'oHbbbHhBBBBBBBBBBBHbbbHo',
    'oHbbHhBBBBBBBBBBBBBHbbHo',
    'oHbHhBBBBBBBBBBBBBBBHbHo',
    'oHHHHHHHHHHHHHHHHHHHHHHo',
    '.oooooooooooooooooooooo.'
  ],{o:'#0b2029',H:'#b98448',h:'#5b4837',B:'#765235',b:'#946743'});
  A.background=(g,t,stage=0)=>{
    if(A.images.depot)g.drawImage(A.images.depot,0,0,640,360);
    else { p.rect(g,0,0,640,360,'#24323c');p.rect(g,0,180,640,180,'#563c31'); }
    // Ambient dust, lit windows, and small overhead line sparks.
    const count=30;
    for(let i=0;i<count;i++){
      const x=((i*137.23+t*(7+(i%5)*2))%690)-25;
      const y=100+((i*41.7)%227)+Math.sin(t*.7+i)*4;
      p.blend(g,.15+(i%3)*.12,'normal',()=>p.rect(g,x,y,i%4===0?3:1,1,i%3?'#c59b69':'#efe2ac'));
    }
    if(stage>=3)p.blend(g,.15,'normal',()=>p.rect(g,0,0,640,360,'#152b45'));
    if(Math.floor(t*3)%17===0){p.line(g,543,108,548,115,'#99eade');p.line(g,548,115,553,110,'#e9f1bb');}
  };
  A.ring=(g,x,y,rx,ry,color,width=1,segments=36,start=0,end=Math.PI*2)=>{
    let ax=x+Math.cos(start)*rx,ay=y+Math.sin(start)*ry;
    for(let i=1;i<=segments;i++){const an=start+(end-start)*i/segments,bx=x+Math.cos(an)*rx,by=y+Math.sin(an)*ry;p.line(g,ax,ay,bx,by,color,width);ax=bx;ay=by;}
  };
  A.enemy=(g,e,t)=>{
    const x=Math.round(e.x), y=Math.round(e.y), s=e.scale||1.25;
    if(e.kind==='drone') {
      const bob=Math.sin(t*7+e.id)*3,yy=y+bob;
      p.ell(g,x,y+23,20,4,'#13242c');
      p.line(g,x-27,yy-6,x+27,yy-6,'#243a47',6);
      p.rect(g,x-33,yy-8,17,3,t*20%2>1?'#a2bdb0':'#527174');p.rect(g,x+16,yy-8,17,3,'#90aaa4');
      p.poly(g,[[x-17,yy-4],[x-8,yy-15],[x+10,yy-15],[x+20,yy-5],[x+11,yy+10],[x-11,yy+10]],'#081b24');
      p.poly(g,[[x-14,yy-5],[x-6,yy-11],[x+8,yy-11],[x+15,yy-4],[x+9,yy+6],[x-9,yy+6]],e.hit>0?'#fff0d3':'#8b6850');
      p.line(g,x-8,yy-8,x+8,yy-8,'#d8ad73',2);p.rect(g,x-7,yy-3,15,6,'#172d38');
      p.rect(g,x-4,yy-2,9,3,e.stun>0?'#85eadf':'#f88747');p.rect(g,x-4,yy+10,7,6,'#476879');
      p.rect(g,x-2,yy+16,3,2,'#b9caca');
      if(e.wind>.05)A.ring(g,x,yy,22,17,'#f8bb6b',1,16);
      return;
    }
    if(e.kind==='turret'){
      p.ell(g,x,y+20,24,5,'#101f25');
      p.line(g,x,y,x-20,y+19,'#0b1820',7);p.line(g,x,y,x+20,y+19,'#0b1820',7);p.line(g,x,y,x,y+23,'#9d8a64',5);
      p.line(g,x,y-3,x-20,y+18,'#698080',3);p.line(g,x,y-3,x+20,y+18,'#698080',3);
      p.poly(g,[[x-21,y-17],[x-14,y-27],[x+15,y-27],[x+23,y-16],[x+18,y+4],[x-17,y+4]],'#101f2b');
      p.rect(g,x-16,y-21,33,18,e.hit>0?'#ebd6a4':'#776644');p.rect(g,x-13,y-21,27,3,'#ad9e75');
      p.rect(g,x-10,y-16,20,10,'#2d4247');p.rect(g,x-7,y-13,14,3,e.stun>0?'#9ffff0':'#ee9754');
      p.rect(g,x-4,y-10,8,18,'#132d3c');p.rect(g,x-2,y-10,3,18,'#79959a');p.rect(g,x-5,y+6,10,3,'#17202b');
      if(e.wind>.05)p.disc(g,x,y+11,4,'#ffd592');
      return;
    }
    const step=e.moving?Math.sin(t*13+e.id)*2:Math.sin(t*3+e.id)*.5;
    p.ell(g,x,y+20*s,14*s,4,'#10232a');
    const sp=A.sprites[e.kind]||A.sprites.gunner;
    g.save();g.translate(x,y+step); if(e.stun>0)g.rotate(Math.sin(t*20)*.03);
    const w=Math.round(sp.w*s),h=Math.round(sp.h*s);
    g.drawImage(e.flip?sp.fl:sp.cv,-Math.round(w/2),-Math.round(h*.62),w,h);
    if(e.kind==='heavy'){
      p.rect(g,-w*.53,-h*.25,w*.23,h*.25,e.hit>0?'#f8edbe':'#759490');p.rect(g,w*.30,-h*.25,w*.23,h*.25,'#698786');
      p.line(g,-w*.5,-h*.25,-w*.32,-h*.25,'#c5c8a3',2);
      if(e.stun<=0){p.rect(g,-w*.20,-h*.16,w*.42,h*.38,'#2b4757');p.rect(g,-w*.16,-h*.12,w*.34,3,'#e9b359');p.rect(g,-2,-3,4,7,'#a6d5c7');}
    }
    if(e.hit>0){p.line(g,-w*.5,-h*.18,-w*.34,-h*.38,'#fff8d6',2);p.line(g,w*.37,0,w*.56,-4,'#ffce78',2);}
    if(e.wind>0){p.disc(g,w*.43,-h*.09,3+Math.sin(t*35),'#ffe4a0');p.rect(g,-2,-h*.75,3,8,'#ffb459');p.dot(g,0,-h*.75+11,'#ffb459');}
    g.restore();g._c=null;
  };
  A.prop=(g,o,t)=>{
    const x=o.x,y=o.y;
    if(o.dead){p.ell(g,x,y+10,21,5,'#13232a');for(let i=0;i<5;i++)p.rect(g,x-19+i*8,y+Math.sin(i*5)*5,9,3,i%2?'#5e493c':'#a26b3f');return;}
    p.ell(g,x,y+17,20,4,'#14232a');
    if(o.kind==='barrel'){
      p.rect(g,x-12,y-19,24,35,'#09222b');p.rect(g,x-10,y-20,20,36,'#9b4d36');p.rect(g,x-7,y-18,5,32,'#c87a46');p.rect(g,x+5,y-18,4,32,'#5b3930');
      p.rect(g,x-12,y-14,24,4,'#4b5f60');p.rect(g,x-12,y+9,24,4,'#4b5f60');p.rect(g,x-5,y-6,10,11,'#1a3136');p.poly(g,[[x+1,y-6],[x-3,y+1],[x,y+1],[x-1,y+6],[x+4,y-1],[x+1,y-1]],'#faca74');
    }else{
      const sp=A.crate;g.drawImage(sp.cv,x-20,y-18,40,34);
      if(o.kind==='supply'){p.rect(g,x-7,y-10,14,16,'#2e696c');p.rect(g,x-4,y-4,8,3,'#b4e2bf');p.rect(g,x-1,y-7,3,9,'#b4e2bf');}
    }
    if(o.hp<o.max){p.line(g,x-8,y-15,x,y-4,'#182932',2);p.line(g,x,y-4,x-3,y+8,'#182932',2);}
    if(o.hit>0)A.ring(g,x,y,22,21,'#f1d190',1,12);
  };
  A.hero=(g,h,t,title=false)=>{
    const x=h.x,y=h.y,jump=h.z||0,w=title?175:68,height=title?263:102;
    p.blend(g,.62,'normal',()=>p.ell(g,x,y-1,title?48:25,title?8:5,'#091b23'));
    if(h.surge>0) {A.ring(g,x,y-28-jump,34,49,'#a5ede0',1,28);A.ring(g,x,y,36,9,'#f9ca68',1,24);}
    if(h.hurt>0&&Math.floor(h.hurt*17)%2===0&&!title)g.globalAlpha=.38;
    g.save();g.translate(Math.round(x),Math.round(y-jump));
    if(h.roll>0){g.translate(0,-24);g.rotate((1-h.roll/.43)*Math.PI*2*(h.rollDir||1));g.scale(.62,.62);g.translate(0,52);}
    const bob=title?Math.sin(t*2)*1:Math.sin(t*(h.moving?14:3))*(h.moving?2:0.5);
    const recoil=h.recoil>0?2:0;
    if(h.face<0)g.scale(-1,1);
    if(A.images.rook)g.drawImage(A.images.rook,-Math.round(w*.58)-recoil,-height+bob,w,height);
    else {p.rect(g,-14,-65,28,55,'#24556a');p.rect(g,-10,-77,20,15,'#b78551');p.rect(g,-21,-63,40,8,'#e9b15b');p.rect(g,-14,-11,10,11,'#192d3b');p.rect(g,6,-11,10,11,'#192d3b');}
    if(h.recoil>0&&!title){const mx=w*.36,my=-height*.80+bob;p.poly(g,[[mx-6,my],[mx+8,my-5],[mx+5,my],[mx+13,my+2],[mx+4,my+3],[mx+2,my+8]],h.surge>0?'#ffffff':'#d6fce4');p.disc(g,mx,my,3,'#fff7cb');}
    g.restore();g.globalAlpha=1;g._c=null;
  };
  A.boss=(g,b,t)=>{
    const x=Math.round(b.x),y=Math.round(b.y),mini=b.mini,s=mini?.68:1;
    if(!mini&&A.images.tithe){
      const bob=Math.round(Math.sin(t*3.5)),open=b.expose>0||b.stun>0||b.phase>=2,cy=y-34+bob;
      p.blend(g,.62,'normal',()=>p.ell(g,x,y+58,110,13,'#071c27'));
      g.drawImage(A.images.tithe,x-122,y-114+bob,245,175);
      if(!open){
        p.disc(g,x,cy,23,'#112c37');A.ring(g,x,cy,23,23,'#b88345',2,24);
        p.poly(g,[[x-18,cy-16],[x-3,cy-20],[x-3,cy+20],[x-18,cy+16]],'#3a555d');
        p.poly(g,[[x+18,cy-16],[x+3,cy-20],[x+3,cy+20],[x+18,cy+16]],'#233e4a');
        p.line(g,x-17,cy-15,x-5,cy-17,'#bcb491',2);p.rect(g,x-4,cy-12,8,25,'#956b43');p.rect(g,x-2,cy-8,4,16,'#132d39');p.rect(g,x-1,cy-4,2,8,'#e6a155');
      }else{
        p.blend(g,.2+Math.sin(t*12)*.1,'normal',()=>p.disc(g,x,cy,18,'#d1fff2'));
        if(b.hit>0)p.disc(g,x,cy,8,'#fff9d6');
        if(Math.floor(t*5)%2===0)A.ring(g,x,cy,27,27,'#e7d09a',1,24);
      }
      for(const side of [-1,1]){
        if(b.wind>0){p.disc(g,x+side*96,y-53+bob,9,'#f1ab56');p.disc(g,x+side*96,y-53+bob,5,'#fff0bd');}
        if(b.action==='fan'&&b.actionTime>0&&Math.floor(t*15)%3===0)p.line(g,x+side*96,y-48,x+side*97,y-30,'#edb66b',2);
        if(b.phase>=1)p.line(g,x+side*54,y-18,x+side*71,y+2,'#0c2431',3);
        if(b.phase>=2||b.stun>0){const xx=x+side*44;p.line(g,xx,y-60,xx+Math.sin(t*32)*7,y-43,'#aefff0',2);p.line(g,xx+Math.sin(t*32)*7,y-43,xx-5,y-18,'#6fd4d1',1);}
        if(b.hit>0){p.line(g,x+side*91,y+29,x+side*108,y+36,'#eac689',2);}
      }
      if(b.phaseShield>0)A.ring(g,x,cy,34,34,'#ffd39a',2,28);
      return;
    }
    g.save();g.translate(x,y);g.scale(s,s);g._c=null;
    const bob=Math.sin(t*4)*1.3, armor=b.hit>0?'#c1b595':'#8d6749',edge='#bb9562',dark='#10252f',steel='#375763',light='#82a19b';
    p.blend(g,.65,'normal',()=>p.ell(g,0,61,112,16,'#05151e'));
    // Tracks and articulated running gear.
    for(const side of [-1,1]){
      const tx=side<0?-108:46;
      p.poly(g,[[tx-3,26],[tx+58,26],[tx+66,39],[tx+61,65],[tx+4,65],[tx-7,52]],'#091b24');
      p.rect(g,tx,31,58,28,'#354d55');p.rect(g,tx+3,34,52,21,'#172e39');
      for(let j=0;j<4;j++){p.disc(g,tx+9+j*14,45,8,'#657777');p.disc(g,tx+9+j*14,45,5,'#223a45');p.rect(g,tx+8+j*14,42,3,6,'#98a093');}
      for(let j=0;j<9;j++){p.rect(g,tx+j*7+Math.floor(t*9)%7,29,4,3,'#ad8d63');p.rect(g,tx+j*7,58,4,4,'#3b5560');}
      p.poly(g,[[tx-7,18],[tx+58,18],[tx+65,32],[tx-7,32]],armor);p.line(g,tx-5,18,tx+57,18,edge,3);
    }
    // Central locomotive hull and lower grille.
    p.poly(g,[[-67,-4+bob],[-48,-43+bob],[48,-43+bob],[68,-4+bob],[61,39],[-61,39]],dark);
    p.poly(g,[[-62,-5+bob],[-44,-39+bob],[44,-39+bob],[63,-5+bob],[55,35],[-54,35]],armor);
    p.poly(g,[[-60,-2],[-37,5],[-34,31],[-55,30]],'#5c4b3c');p.poly(g,[[60,-2],[37,5],[34,31],[55,30]],'#493e38');
    p.rect(g,-36,11,73,27,steel);for(let i=-28;i<=29;i+=8)p.rect(g,i,15,3,18,'#0a2634');p.line(g,-36,11,36,11,light,2);
    p.poly(g,[[-76,41],[-51,32],[51,32],[76,41],[48,53],[-48,53]],'#102c37');for(let i=-48;i<50;i+=12)p.line(g,i,38,i*1.22,48,'#587b7d',3);
    // Smokestacks, broad shoulders, and angled copper pipes.
    for(const side of [-1,1]){
      p.rect(g,side*43-7,-109+bob,15,63,steel);p.rect(g,side*43-9,-109+bob,19,8,'#b39166');p.rect(g,side*43-4,-99+bob,5,49,'#708b8b');
      p.line(g,side*39,-56+bob,side*69,-72+bob,'#0d222e',13);p.line(g,side*39,-56+bob,side*69,-72+bob,'#b07743',7);
      p.poly(g,[[side*37,-83+bob],[side*74,-92+bob],[side*99,-73+bob],[side*88,-34+bob],[side*51,-34+bob]],dark);
      p.poly(g,[[side*41,-80+bob],[side*74,-87+bob],[side*93,-71+bob],[side*84,-40+bob],[side*54,-40+bob]],armor);
      p.line(g,side*47,-77+bob,side*72,-83+bob,edge,3);
      for(let j=0;j<3;j++)p.rect(g,side*68-7,-69+j*8+bob,17,3,'#203b47');
      const aim=(b.action==='fan'?Math.sin(b.age*2)*6:0),cy=-32+bob+aim;
      p.line(g,side*73,-47+bob,side*98,cy,'#0a2430',25);p.line(g,side*73,-47+bob,side*98,cy,steel,19);
      p.rect(g,side*98-12,cy-8,24,22,'#233f4c');p.rect(g,side*98-9,cy-5,18,15,'#0b202a');
      for(let j=0;j<3;j++)p.disc(g,side*98-5+j*5,cy+2,2,b.wind>0?'#ffbe67':'#658f92');
      p.line(g,side*85,cy-9,side*105,cy-9,'#94a99d',2);
      for(const [rx,ry]of[[side*55,-62],[side*82,-53],[side*50,-8]])p.rect(g,rx-1,ry+bob,3,3,'#dac79e');
    }
    // Cab, visor, and a core that opens for counterfire.
    p.poly(g,[[-29,-107+bob],[25,-107+bob],[35,-92+bob],[30,-57+bob],[-31,-57+bob],[-36,-89+bob]],'#0b222d');
    p.rect(g,-28,-102+bob,53,41,armor);p.rect(g,-29,-106+bob,55,6,edge);p.rect(g,-33,-87+bob,63,18,steel);p.rect(g,-27,-83+bob,51,9,'#091d29');
    p.rect(g,-23,-80+bob,43,3,b.phase>=2?'#fc805e':'#f4c37a');p.rect(g,-5,-96+bob,10,6,'#3b6c78');
    p.rect(g,-24,-58+bob,47,54,'#112d39');p.rect(g,-20,-55+bob,39,46,'#668582');
    const open=b.expose>0||b.stun>0||b.phase>=2;
    if(open){
      p.poly(g,[[-13,-51+bob],[10,-51+bob],[17,-39+bob],[11,-16+bob],[-12,-16+bob],[-18,-39+bob]],'#15374a');
      p.disc(g,-1,-34+bob,12,b.hit>0?'#ffffff':'#54c8c0');p.disc(g,-1,-34+bob,8,'#a2f2dc');p.disc(g,-1,-34+bob,4,'#fff4b6');
      p.rect(g,-25,-56+bob,8,43,armor);p.rect(g,17,-56+bob,8,43,armor);
      if(Math.floor(t*9)%2===0)A.ring(g,-1,-34+bob,18,18,'#f4ce76',1,20);
    }else{p.rect(g,-17,-52+bob,33,41,armor);p.line(g,0,-51+bob,0,-11+bob,'#503f33',2);p.poly(g,[[-9,-41+bob],[7,-41+bob],[7,-23+bob],[-9,-23+bob]],'#214352');p.rect(g,-6,-35+bob,10,4,'#d08b4e');}
    if(b.phase>=1){p.line(g,-47,-22,-35,-9,'#12242b',3);p.line(g,37,-85,24,-63,'#172930',3);}
    if(b.phase>=2){p.rect(g,-75,-52,8,6,'#eaa05e');p.line(g,41,-24,52,-14,'#ffd390',2);}
    if(b.stun>0){for(let i=0;i<4;i++){const xx=-76+i*49;p.line(g,xx,-65+Math.sin(t*24+i)*12,xx+12,-40,'#92fae6',2);p.line(g,xx+12,-40,xx+5,-23,'#e7ffbe',1);}}
    g.restore();g._c=null;
  };
  A.pickup=(g,o,t)=>{
    const y=o.y+Math.sin(t*4+o.id)*3,color=o.kind==='heal'?'#83dfbf':o.kind==='rapid'?'#96d8f1':o.kind==='scatter'?'#f1b063':'#ffe2a0';
    p.ell(g,o.x,o.y+18,12,3,'#132d34');A.ring(g,o.x,y,16,16,color,1,8);
    p.rect(g,o.x-11,y-11,22,22,'#102a36');p.rect(g,o.x-9,y-9,18,18,'#244a54');
    if(o.kind==='heal'){p.rect(g,o.x-2,y-7,4,14,color);p.rect(g,o.x-7,y-2,14,4,color);}
    else if(o.kind==='charge'){p.poly(g,[[o.x+1,y-8],[o.x-6,y+1],[o.x,y+1],[o.x-1,y+8],[o.x+7,y-2],[o.x+1,y-2]],color);}
    else {for(let i=-1;i<=1;i++)p.line(g,o.x+i*4,y+5,o.x+i*(o.kind==='scatter'?6:4),y-5,color,2);}
    E.font.text(g,o.kind==='heal'?'REPAIR':o.kind.toUpperCase(),o.x,y+21,color,{align:'center',outline:'#0a1d28'});
  };
  // A new score written for the engine's chip synthesizer. No source-game recordings or melodies.
  const bass='D2 . A2 . D3 . A2 . | D2 . A2 . C3 . A2 . | F2 . C3 . F3 . C3 . | G2 . D3 . A2 . C3 .';
  const lead='D5 - . A4 C5 D5 . F5 | E5 - D5 . C5 . A4 . | D5 . F5 G5 A5 - G5 F5 | E5 . D5 - C5 . A4 . | F5 - . E5 D5 . C5 . | A4 . C5 D5 F5 - E5 . | G5 . F5 . E5 . C5 . | D5 - - . A4 . C5 .';
  A.music={
    level:{bpm:119,steps:4,tracks:[{wave:'pulse12',vol:.10,dur:.14,notes:lead},{wave:'triangle',vol:.19,notes:bass},{wave:'pulse',vol:.035,notes:'D4 . . A3 . . C4 . | F4 . . C4 . . D4 . | F4 . . A4 . . C5 . | G4 . . D4 . . A3 .'}, {wave:'drums',vol:.14,notes:'k . h . s . h h | k . h . s . h .'}]},
    boss:{bpm:146,steps:4,tracks:[{wave:'pulse',vol:.09,notes:'D4 D5 A4 D5 F4 D5 A4 C5 | D4 D5 A4 D5 G4 E5 C5 A4 | F4 F5 C5 F5 A4 F5 C5 E5 | G4 G5 D5 F5 A4 E5 C5 A4'},{wave:'triangle',vol:.20,notes:'D2 D2 A2 D3 D2 D2 C3 A2 | D2 D2 A2 D3 C3 A2 F2 E2 | F2 F2 C3 F3 F2 F2 C3 A2 | G2 G2 D3 G3 A2 A2 E3 A3'},{wave:'drums',vol:.17,notes:'k h h h s h k h | k h k h s h o h'}]},
    victory:{bpm:104,steps:4,tracks:[{wave:'pulse12',vol:.10,notes:'D5 - F5 . A5 - . G5 | F5 - D5 . C5 - A4 . | D5 - F5 . A5 - C6 . | D6 - - - - - - .'}, {wave:'triangle',vol:.15,notes:'D3 . A3 . D4 . A3 . | F3 . C4 . F4 . C4 . | G3 . D4 . G4 . D4 . | D3 . A3 . D4 - - .'}]}
  };
})();
