const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const asset=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Could not load '+src));i.src=src;});

export function getRingLayout(W,H,title=false){
  const portrait=H>W,scale=portrait?Math.min(W/720,H/1280):H/720;
  const offsetX=W/2-640*scale,offsetY=portrait?H*(title?.10:.20)-128*scale:0;
  return {W,H,portrait,scale,offsetX,offsetY,targetX:portrait||!title?640:(W*.68-offsetX)/scale,handSpread:portrait?190:248,handWidth:portrait?235:278};
}

export class Ring {
  constructor(game,settings){
    this.game=game;this.settings=settings;this.images={};this.loaded=false;this.sparks=[];this.rings=[];
    this.center=860;this.lastTime=0;this.pulse=0;this.hitSide=1;this.flash=0;
    this.dust=Array.from({length:38},(_,i)=>({x:((i*347.17)%1280)/1280,y:((i*173.7)%700)/700,phase:i*1.37,size:.7+(i%3)*.55}));
  }
  async load(){
    const [arena,rook,gloves]=await Promise.all([asset('./assets/arena.png'),asset('./assets/rook-sheet.png'),asset('./assets/player-gloves.png')]);
    this.images={arena,rook,gloves};this.loaded=true;
    this.frames=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=512;c.getContext('2d').drawImage(rook,(i%3)*512,Math.floor(i/3)*512,512,512,0,0,512,512);return c;});
    this.handFrames=[0,1].map(i=>{const c=document.createElement('canvas');c.width=288;c.height=384;const h=c.getContext('2d');h.imageSmoothingQuality='high';h.drawImage(gloves,i*768,0,768,1024,0,0,288,384);return c;});
  }
  prepareBackdrop({W,H,scale}){
    const pad=Math.ceil(64*scale),width=Math.ceil(W+pad*2),height=Math.ceil(H+pad*2);
    if(this.backdrop?.width===width&&this.backdrop?.height===height)return;
    this.backdrop=document.createElement('canvas');this.backdrop.width=width;this.backdrop.height=height;
    const image=this.images.arena,k=Math.max(width/image.width,height/image.height),g=this.backdrop.getContext('2d');
    g.imageSmoothingQuality='high';g.drawImage(image,(width-image.width*k)/2,(height-image.height*k)/2,image.width*k,image.height*k);
  }
  effect(event){
    if(event.type==='hit'){
      this.hitSide=event.hand==='left'?-1:1;this.flash=event.special?.21:.09;
      const x=640+(event.hand==='left'?-45:45),y=event.target==='head'?278:440;
      const count=event.special?30:event.counter?20:11;
      for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*(event.special?480:290);this.sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-70,life:.35+Math.random()*.35,t:0,size:event.special?3:2,color:i%3?'#fff1c7':'#ff8144'});}
      this.rings.push({x,y,t:0,dur:.30,size:event.special?110:65});
    }
    if(event.type==='evade'&&event.perfect){this.pulse=.4;}
  }
  draw(g,bout){
    const game=this.game,t=game.real,dt=Math.min(.05,Math.max(0,t-this.lastTime));this.lastTime=t;
    const reduced=this.settings.reducedMotion;const active=!['title','result','trainingDone'].includes(bout.mode);
    const title=bout.mode==='title',layout=getRingLayout(game.screen.W,game.screen.H,title);
    const {W,H,scale,offsetX,offsetY,portrait}=layout;
    this.center=portrait?640:mix(this.center,layout.targetX,1-Math.exp(-dt*5));
    this.flash=Math.max(0,this.flash-dt);this.pulse=Math.max(0,this.pulse-dt);
    const p=bout.playerAction;let slip=0,duck=0;
    if(p){const a=Math.sin(clamp(p.time/p.duration)*Math.PI);if(p.kind==='duck')duck=a;else slip=(p.kind==='left'?-1:1)*a;}
    const shake=(reduced?0:game.shakeAmt*this.settings.shake);
    g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='low';
    g.translate(Math.sin(t*77)*shake*scale,Math.sin(t*91)*shake*.55*scale);
    const fall=bout.mode==='playerDown'&&!reduced?ease(bout.modeTime/.6):0,angle=-.11*fall;
    if(fall){const px=W/2,py=offsetY+400*scale;g.translate(px,py);g.rotate(angle);g.translate(-px,-py);}
    const sx=reduced?0:slip*-23*scale,sy=reduced?0:duck*-20*scale;
    if(this.loaded){
      this.prepareBackdrop(layout);
      const c=Math.cos(angle),s=Math.abs(Math.sin(angle)),zoom=Math.max((W*c+H*s)/W,(H*c+W*s)/H);
      const width=this.backdrop.width*zoom,height=this.backdrop.height*zoom;
      g.drawImage(this.backdrop,(W-width)/2+sx,(H-height)/2+sy,width,height);
    }else {g.fillStyle='#102027';g.fillRect(0,0,W,H);}
    const shade=g.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(4,13,16,.56)');shade.addColorStop(.48,'rgba(4,13,16,.12)');shade.addColorStop(1,'rgba(5,12,14,.36)');g.fillStyle=shade;g.fillRect(0,0,W,H);
    if(title){
      const side=portrait?g.createLinearGradient(0,H*.5,0,H):g.createLinearGradient(0,0,W*.844,0);
      if(portrait){side.addColorStop(0,'transparent');side.addColorStop(.5,'rgba(6,18,21,.65)');side.addColorStop(1,'rgba(6,18,21,.96)');}
      else {side.addColorStop(0,'rgba(6,18,21,.94)');side.addColorStop(.44,'rgba(7,19,21,.82)');side.addColorStop(.8,'rgba(7,19,21,.12)');side.addColorStop(1,'transparent');}
      g.fillStyle=side;g.fillRect(0,0,W,H);
    }
    if(!reduced){g.save();g.globalCompositeOperation='screen';for(const d of this.dust){const x=(d.x*W+Math.sin(t*.11+d.phase)*20*scale+W)%W,y=((d.y*H-t*4*scale)%H+H)%H;g.globalAlpha=(.18+Math.sin(t+d.phase)*.1);g.fillStyle='#ffcc83';g.beginPath();g.arc(x,y,d.size*scale,0,Math.PI*2);g.fill();}g.restore();}
    // Fight art and impacts share one canonical 1280 × 720 coordinate system.
    g.save();g.translate(offsetX,offsetY);g.scale(scale,scale);
    if(this.loaded)this.drawOpponent(g,bout,{x:this.center-slip*(portrait?42:65),y:128-duck*28,t,reduced,title});
    if(active&&this.loaded)this.drawHands(g,bout,{slip,duck,t,reduced,layout});
    if(!reduced){
      for(const s of this.sparks){s.t+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=340*dt;g.globalAlpha=clamp(1-s.t/s.life);g.strokeStyle=s.color;g.lineWidth=s.size;g.lineCap='round';g.beginPath();g.moveTo(s.x,s.y);g.lineTo(s.x-s.vx*.022,s.y-s.vy*.022);g.stroke();}
      this.sparks=this.sparks.filter(s=>s.t<s.life);g.globalAlpha=1;
      for(const r of this.rings){r.t+=dt;const k=clamp(r.t/r.dur);g.globalAlpha=(1-k)*.7;g.strokeStyle='#fff2ce';g.lineWidth=3*(1-k);g.beginPath();g.arc(r.x,r.y,10+r.size*k,0,Math.PI*2);g.stroke();}this.rings=this.rings.filter(r=>r.t<r.dur);g.globalAlpha=1;
    }else{this.sparks.length=0;this.rings.length=0;}
    g.restore();
    const focusY=offsetY+340*scale,radius=Math.max(W,H);
    if(bout.playerHurt>0&&this.settings.flash){const v=g.createRadialGradient(W/2,focusY,170*scale,W/2,focusY,radius*.524);v.addColorStop(0,'transparent');v.addColorStop(1,`rgba(236,73,43,${bout.playerHurt*1.7*this.settings.flash})`);g.fillStyle=v;g.fillRect(0,0,W,H);}
    const v=g.createRadialGradient(W/2,focusY,200*scale,W/2,focusY,radius*.625);v.addColorStop(0,'transparent');v.addColorStop(1,'rgba(3,12,15,.45)');g.fillStyle=v;g.fillRect(0,0,W,H);
    if(bout.mode==='playerDown'){g.fillStyle='rgba(8,14,17,.34)';g.fillRect(0,0,W,H);}
    g.restore();g.globalAlpha=1;
  }
  drawOpponent(g,b,{x,y,t,reduced,title}){
    const e=b.enemy;let pose=0,blend=0,rot=0,scale=1,lean=0,top=y;
    const breath=reduced?0:Math.sin(t*3.6)*3.5;
    if(e.state==='telegraph'&&b.mode==='fight'){
      const a=clamp(e.time/e.duration);pose=e.move.pose;blend=ease(a)*.34;
      const direction=pose===1?-1:1;lean=direction*18*ease(a);rot=direction*.024*ease(a);scale=1-.025*ease(a);
      if(e.move.feint){lean+=Math.sin(a*9)*13;blend=.16+.15*Math.sin(a*7);}
      if(e.move.id==='body')top+=18*ease(a);
      if(e.move.id==='hook'){blend=.70*ease(a);rot=.045*ease(a);}
    }
    if(e.state==='strike'&&b.mode==='fight'){pose=e.move.pose;blend=1;scale=1.065;top+=3;lean=(pose===1?-1:1)*28;}
    if(e.state==='between'&&b.mode==='fight'){pose=e.move.pose;blend=.85*(1-ease(e.time/e.duration));}
    if(e.state==='recover'&&b.mode==='fight'){pose=e.move?.pose||0;blend=.75*(1-ease(e.time/.25));scale=1-.015*Math.sin(e.time*8);}
    if(e.state==='stagger'&&b.mode==='fight'){pose=4;blend=.88;rot=Math.sin(t*5)*.023;top+=8;}
    if(b.enemyHurt>0&&b.mode==='fight'){pose=4;blend=Math.min(1,b.enemyHurt*7);rot=this.hitSide*-.045*blend;lean-=this.hitSide*15*blend;}
    if(b.mode==='opponentDown'||(b.mode==='result'&&b.result?.won)){pose=5;blend=1;top+=72*ease(b.modeTime/.65);scale=.97;rot=0;}
    if(b.mode==='phase'){pose=4;blend=.9*(1-ease(b.modeTime/2.2));top+=12*blend;}
    if(b.mode==='intro'){scale=.97+.03*ease(b.modeTime/2);}
    if(reduced){rot=0;lean*=.3;}
    const size=title?608:602;
    g.save();g.translate(x+lean,top+size+breath);g.rotate(rot);g.scale(scale,scale);g.translate(-size/2,-size);
    // Each source pose is a 512 px square. Blend only across short pose transitions.
    const glow=e.state==='stagger'?'#ffd377':e.state==='recover'&&e.opening?'#74e4cb':null;
    if(glow){g.shadowColor=glow;g.shadowBlur=this.settings.reducedMotion?4:14;}
    if(blend<.999){g.globalAlpha=1-clamp(blend);g.drawImage(this.frames[0],0,0,size,size);}
    if(blend>0){g.globalAlpha=clamp(blend);g.drawImage(this.frames[pose],0,0,size,size);}
    g.globalAlpha=1;g.shadowBlur=0;g.restore();
    if(e.state==='stagger'&&b.mode==='fight'&&!reduced){
      g.save();g.strokeStyle='#ffd475';g.lineWidth=2;g.globalAlpha=.8;
      for(let i=0;i<3;i++){const a=t*2.6+i*Math.PI*2/3,xx=x+Math.cos(a)*75,yy=top+35+Math.sin(a)*13;g.beginPath();g.moveTo(xx-6,yy);g.lineTo(xx+6,yy);g.moveTo(xx,yy-6);g.lineTo(xx,yy+6);g.stroke();}g.restore();
    }
  }
  drawHands(g,b,{slip,duck,t,reduced,layout}){
    if(b.mode==='opponentDown'||b.mode==='phase')return;
    let intro=b.mode==='intro'?ease((b.modeTime-1.3)/1.2):1;
    let down=b.mode==='playerDown'?ease(b.modeTime/.65):0;
    for(const hand of ['left','right']){
      const side=hand==='left'?-1:1,p=b.punch&&b.punch.hand===hand?b.punch:null;
      let x=640+side*layout.handSpread+slip*(layout.portrait?-58:-95),y=675+duck*100+(1-intro)*350+down*310;
      let w=layout.handWidth,rotation=side*-.05+(reduced?0:Math.sin(t*3.6+side)*.025);
      if(!reduced)y+=Math.sin(t*3.6+side)*5;
      if(b.guard){x=640+side*(layout.portrait?110:135);y=475;rotation=side*.14;w=layout.handWidth*289/278;}
      if(p){const reach=p.time<p.impact?ease(p.time/p.impact):1-ease((p.time-p.impact)/(p.duration-p.impact));x=mix(x,640+side*(p.special?-12:48),reach);y=mix(y,p.target==='head'?306:455,reach);w=mix(w,layout.handWidth*(p.special?270:192)/278,reach);rotation+=side*.35*reach;}
      const h=w*1024/768;
      g.save();g.translate(x,y);g.rotate(rotation);
      if(b.focus>=100){g.shadowColor='#ffb057';g.shadowBlur=14;}
      g.drawImage(this.handFrames[hand==='left'?0:1],-w/2,-h*.43,w,h);g.restore();
    }
  }
}
