import { LEVEL, lineY } from './simulation.js';
const TAU=Math.PI*2;
function path(g,pts,close=true){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));if(close)g.closePath();}
function glow(g,x,y,r,color,alpha=.5){g.save();const grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,color);grad.addColorStop(1,'transparent');g.globalAlpha=alpha;g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2);g.restore();}
function line(g,x1,y1,x2,y2,color,width=1){g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();}
function label(g,text,x,y,color='#9ab7b9',size=16,align='center'){g.save();g.font=`500 ${size}px "Courier New",monospace`;g.textAlign=align;g.fillStyle=color;g.shadowColor='#030d12';g.shadowBlur=5;g.fillText(text,x,y);g.restore();}
function rect(g,x,y,w,h,fill,stroke){g.fillStyle=fill;g.fillRect(x,y,w,h);if(stroke){g.strokeStyle=stroke;g.lineWidth=1;g.strokeRect(x,y,w,h);}}
export class WorldRenderer {
  constructor(game,mission,assets){this.game=game;this.m=mission;this.assets=assets;this.face=1;this.angle=0;this.gateTween={};this.last=0;this.motes=Array.from({length:90},(_,i)=>({x:(i*137.31)%1800,y:(i*83.23)%760,r:.8+(i%4)*.4,s:4+(i%7)*3}));}
  draw(r,title=false){
    const g=r.ctx,m=this.m,t=this.game.real,dt=Math.min(.05,t-this.last);this.last=t;g.imageSmoothingEnabled=true;
    this.background(r,t,title);
    if(title){this.titleShip(r,t);this.atmosphere(r,t,title);return;}
    this.cave(r,t);this.drawDocks(r,t);
    for(const gate of LEVEL.gates)this.gate(r,gate,t,dt);
    for(const w of m.watchers)this.watcher(r,w,t);
    this.cell(r,t);this.echoes(r,t);this.terminals(r,t);
    if(m.towing){const [x,y]=r.w(m.ship.x-29,m.ship.y+17),[cx,cy]=r.w(m.cell.x,m.cell.y);g.save();g.strokeStyle='#88ddd7';g.lineWidth=2;g.setLineDash([7,5]);g.lineDashOffset=-t*20;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo((x+cx)/2,(y+cy)/2+23,cx,cy);g.stroke();g.restore();glow(g,(x+cx)/2,(y+cy)/2,30,'#60d9c6',.15);}
    this.drawShip(r,t);
    for(const rock of m.rocks){const [x,y]=r.w(rock.x,rock.y);if(rock.life<.7){glow(g,x,y+34,60,'#ffb36c',.5);label(g,'!',x,y+70,'#ffc586',25);continue;}g.save();g.translate(x,y);g.rotate(rock.rotation+rock.life);path(g,[[-rock.r,-rock.r*.6],[0,-rock.r],[rock.r,0],[rock.r*.5,rock.r],[-rock.r*.7,rock.r*.6]]);g.fillStyle='#173138';g.fill();g.strokeStyle='#7b7063';g.stroke();g.restore();}
    r.overlay(()=>this.atmosphere(r,t,false));
  }
  background(r,t,title){
    const g=r.ctx,img=this.assets.cavern,W=r.W,H=r.H;
    g.fillStyle='#06151d';g.fillRect(0,0,W+2,H+2);
    if(img){const h=H*1.18,w=h*img.width/img.height,x=-((title?t*2:this.game.cam.x*.15)%(w*.94));g.save();g.globalAlpha=.9;g.drawImage(img,x-20,-H*.08,w,h);g.drawImage(img,x+w*.94-20,-H*.08,w,h);g.restore();}
    const veil=g.createLinearGradient(0,0,0,H);veil.addColorStop(0,'#03111b66');veil.addColorStop(.45,'#03111b05');veil.addColorStop(1,'#0411178c');g.fillStyle=veil;g.fillRect(0,0,W,H);
    // Moving light shafts and fine particles establish distance without hiding the flight path.
    for(let i=0;i<4;i++){const bx=((i*563-this.game.cam.x*.06)%2200+2200)%2200-150;g.save();g.globalAlpha=.018+Math.sin(t*.12+i)*.005;path(g,[[bx,-20],[bx+55,-20],[bx+170,H],[bx-190,H]]);g.fillStyle='#a0fff0';g.fill();g.restore();}
  }
  cave(r,t){
    const g=r.ctx,cx=r.ix,cy=r.iy;
    for(const [points,top] of [[LEVEL.ceiling,true],[LEVEL.floor,false]]){
      const pts=points.map(p=>[p[0]-cx,p[1]-cy]);const fillpts=top?[[0,-200],...pts,[LEVEL.width-cx,-200]]:[[0,1200],...pts,[LEVEL.width-cx,1200]];
      path(g,fillpts);const grad=g.createLinearGradient(0,top?0:550-cy,0,top?260-cy:900-cy);grad.addColorStop(0,top?'#030c12':'#0c262e');grad.addColorStop(1,top?'#102b31':'#020b12');g.fillStyle=grad;g.fill();
      path(g,pts,false);g.strokeStyle='#3b626365';g.lineWidth=3;g.stroke();
      for(let wx=Math.floor(cx/70)*70;wx<cx+r.W+70;wx+=70){if(wx<0||wx>LEVEL.width)continue;const y=lineY(points,wx)-cy+(top?-12:14),x=wx-cx;const h=12+(Math.sin(wx*.075)+1)*17;g.fillStyle=top?'#061118':'#051219';path(g,top?[[x,y],[x+45,y-18],[x+57,y+h],[x+18,y+h+15]]:[[x,y],[x+48,y+7],[x+59,y+h+14],[x+8,y+h]]);g.fill();line(g,x+4,y,x+37,y+6,'#3b545341',1);}
    }
    // Industrial struts are physical landmarks, with calm pools between the hazards.
    for(let wx=420;wx<LEVEL.width;wx+=580){if(wx<cx-80||wx>cx+r.W+80)continue;const x=wx-cx,top=lineY(LEVEL.ceiling,wx)-cy,bottom=lineY(LEVEL.floor,wx)-cy;rect(g,x-5,top-80,10,100,'#15292e','#41606755');line(g,x,top+22,x+20,top+73,'#1a363d',3);glow(g,x,top+20,45,'#ffc381',.25);rect(g,x-3,top+17,6,5,'#edb77d');for(let j=0;j<5;j++)rect(g,x-50+j*24,bottom+26,14,5,'#40615d36');}
    for(const p of LEVEL.checkpoints){const [x,y]=r.w(p.x,lineY(LEVEL.floor,p.x));if(x<-200||x>r.W+200)continue;glow(g,x,y-50,145,'#75d5ca',.11);}
  }
  drawDocks(r,t){
    const g=r.ctx;for(const dock of [{x:300,y:595,name:'ARRIVAL / 01',width:260},{x:7990,y:650,name:'EXTRACTION',width:280}]){
      const [x,y]=r.w(dock.x,dock.y);if(x<-400||x>r.W+400)continue;
      rect(g,x-dock.width/2,y,dock.width,22,'#253c41','#628083');rect(g,x-dock.width/2+13,y+22,15,100,'#10212a');rect(g,x+dock.width/2-28,y+22,15,100,'#10212a');
      for(let a=-dock.width/2+10;a<dock.width/2;a+=22){g.fillStyle='#c28a568c';path(g,[[x+a,y],[x+a+10,y],[x+a-1,y+7],[x+a-11,y+7]]);g.fill();}
      for(const k of [-1,1]){glow(g,x+k*(dock.width/2-12),y-7,70,'#77e3ca',.4);rect(g,x+k*(dock.width/2-12)-4,y-9,8,5,'#bbffe1');}
      label(g,dock.name,x,y+57,'#8eb2b2',16);if(dock.x>7000&&this.m.archive){g.save();g.strokeStyle='#7bf1cf66';g.setLineDash([5,13]);g.lineWidth=2;g.strokeRect(x-116,y-123,232,109);g.restore();label(g,'POWER OFF · HOLD E',x,y-148,'#b7f4df',18);}
    }
  }
  gate(r,gate,t,dt){
    const g=r.ctx,x=gate.x-r.ix,top=lineY(LEVEL.ceiling,gate.x)-r.iy,bottom=lineY(LEVEL.floor,gate.x)-r.iy;if(x<-160||x>r.W+160)return;
    this.gateTween[gate.id]=Math.min(1,(this.gateTween[gate.id]||0)+(this.m.open[gate.id]?dt*.85:0));
    if(!this.m.open[gate.id])this.gateTween[gate.id]=0;
    const k=this.gateTween[gate.id],color=k>.9?'#85e3c5':'#e7a065',h=(bottom-top)/2;
    rect(g,x-gate.w/2-12,top,12,bottom-top,'#08151ce6','#48626c');
    rect(g,x+gate.w/2,top,12,bottom-top,'#08151ce6','#48626c');
    for(const isTop of [true,false]){const sh=h*(1-k),yy=isTop?top:bottom-sh;rect(g,x-gate.w/2,yy,gate.w,sh,'#20333b','#5d7472');for(let gy=yy+15;gy<yy+sh;gy+=27)line(g,x-gate.w/2+4,gy,x+gate.w/2-4,gy,'#0b1b24',5);}
    for(const side of [-1,1]){line(g,x+side*(gate.w/2+8),top+15,x+side*(gate.w/2+8),bottom-15,color,3);glow(g,x+side*35,(top+bottom)/2,70,color,.17);}
    label(g,gate.label,x,top-28,'#729c9e',16);
  }
  watcher(r,w,t){
    const g=r.ctx,[x,y]=r.w(w.x,w.y);if(x<-w.r-100||x>r.W+w.r+100)return;
    const dormant=w.dormant&&!this.m.archive,detected=w.exposure>.03,color=detected?'#ff8b6c':w.kind==='electricity'?'#9aa8fc':w.kind==='all'?'#f1b97f':'#72ccc7';
    if(!dormant){g.save();g.strokeStyle=color;g.globalAlpha=w.scanned?.22:.09;g.lineWidth=1.2;g.setLineDash([5,10]);g.lineDashOffset=t*4;g.beginPath();g.arc(x,y,w.r,0,TAU);g.stroke();g.setLineDash([]);if(w.scanned||this.m.scanning){const rad=g.createRadialGradient(x,y,35,x,y,w.r);rad.addColorStop(0,'transparent');rad.addColorStop(.93,`${color}05`);rad.addColorStop(1,`${color}24`);g.globalAlpha=1;g.fillStyle=rad;g.beginPath();g.arc(x,y,w.r,0,TAU);g.fill();}g.restore();}
    line(g,x-4,lineY(LEVEL.ceiling,w.x)-r.iy,x-4,y-45,'#16272e',8);line(g,x+7,lineY(LEVEL.ceiling,w.x)-r.iy,x+7,y-45,'#51606366',2);
    glow(g,x,y,120,color,dormant?.05:.22+Math.sin(t*1.3)*.04);
    g.save();g.translate(x,y);g.rotate(Math.sin(t*.25+w.x)*.13);
    for(let i=0;i<3;i++){g.save();g.rotate(i*TAU/3+t*.04);path(g,[[-13,-33],[-22,-71],[10,-82],[25,-57],[16,-29]]);g.fillStyle='#233741';g.fill();g.strokeStyle='#5f7c7b';g.lineWidth=2;g.stroke();line(g,-10,-59,7,-66,dormant?'#334750':color,3);g.restore();}
    g.fillStyle='#06131c';g.strokeStyle='#92b0a0';g.lineWidth=2;g.beginPath();g.arc(0,0,36,0,TAU);g.fill();g.stroke();g.strokeStyle=color;g.globalAlpha=.6;g.beginPath();g.arc(0,0,26,t*.5,t*.5+4.7);g.stroke();g.globalAlpha=1;
    const eye=dormant?3:10+Math.sin(t*2)*1.2;g.fillStyle=dormant?'#30444f':color;g.beginPath();g.ellipse(0,0,eye,eye*.72,Math.atan2(this.m.ship.y-w.y,this.m.ship.x-w.x),0,TAU);g.fill();g.restore();
    if(w.scanned){label(g,w.name.toUpperCase(),x,y+115,color,17);const sig=w.kind==='electricity'?'ELECTRIC < 18':w.kind==='all'?'HEAT < 32 / NOISE < 18 / ELECTRIC < 16':w.id==='exit'?'HEAT < 48 / NOISE < 28':'NOISE < 24';label(g,sig,x,y+139,'#afbfbc',14);}
    else if(!dormant&&Math.hypot(this.m.ship.x-w.x,this.m.ship.y-w.y)<650){label(g,'UNKNOWN SIGNAL',x,y+111,'#9fc2be',16);if(w.progress>0){line(g,x-45,y+130,x+45,y+130,'#294b53',3);line(g,x-45,y+130,x-45+w.progress*90,y+130,'#c7fced',3);}}
    if(detected){g.save();g.strokeStyle='#ff9c7d';g.lineWidth=3;g.beginPath();g.arc(x,y,49,-Math.PI/2,-Math.PI/2+TAU*w.exposure);g.stroke();g.restore();}
    if(w.laser>1.42){const [sx,sy]=r.w(this.m.ship.x,this.m.ship.y);line(g,x,y,sx,sy,'#fc81596e',13);line(g,x,y,sx,sy,'#ffe1b0',2);}
  }
  cell(r,t){
    const g=r.ctx,m=this.m,[x,y]=r.w(m.cell.x,m.cell.y),[sx,sy]=r.w(LEVEL.socket.x,LEVEL.socket.y);
    if(sx>-160&&sx<r.W+160){glow(g,sx,sy,100,m.open.cell?'#85f0d1':'#ffc68b',.18);g.strokeStyle=m.open.cell?'#81dcb9':'#bf9466';g.lineWidth=4;g.strokeRect(sx-49,sy-51,98,102);for(let i=-1;i<=1;i+=2){rect(g,sx+i*54-8,sy-63,16,125,'#1b3139','#426065');line(g,sx+i*37,sy-35,sx+i*37,sy+35,'#dfb984',3);}label(g,m.open.cell?'GRID RESTORED':'POWER CELL SOCKET',sx,sy+87,m.open.cell?'#a9eccc':'#e8c397',17);}
    if(x<-160||x>r.W+160)return;glow(g,x,y,61,'#f7c789',.3);g.save();g.translate(x,y);g.rotate(m.open.cell?0:Math.sin(t*1.5)*.04);rect(g,-24,-28,48,56,'#172f38','#d4a86f');rect(g,-31,-22,9,44,'#bd7e45','#edb779');rect(g,22,-22,9,44,'#bd7e45','#edb779');for(let j=0;j<3;j++){rect(g,-13,-16+j*13,26,7,'#7fe4d5');}g.restore();if(!m.open.cell)label(g,m.towing?'TOW LINK ACTIVE':'POWER CELL',x,y-55,m.towing?'#a9eccc':'#efd3a5',16);
  }
  echoes(r,t){
    const g=r.ctx;for(const e of LEVEL.echoes){if(this.m.echoes.includes(e.id))continue;const [x,y]=r.w(e.x,e.y);if(x<-100||x>r.W+100)continue;glow(g,x,y,60,'#b5cff8',.13);g.save();g.strokeStyle='#b8cce186';g.translate(x,y);g.rotate(Math.PI/4);g.strokeRect(-15,-15,30,30);g.restore();for(let i=0;i<5;i++)line(g,x-12+i*6,y-Math.sin(t*2+i)*9-5,x-12+i*6,y+Math.sin(t*2+i)*9+5,'#becfea',2);if(Math.hypot(this.m.ship.x-e.x,this.m.ship.y-e.y)<210){label(g,'HOLD SCAN · LOST SIGNAL',x,y-43,'#c7d5ea',16);const p=this.m.echoProgress[e.id]||0;line(g,x-35,y+40,x-35+p*70,y+40,'#d5e2fa',2);}}
  }
  terminals(r,t){
    const g=r.ctx,m=this.m;
    for(const terminal of LEVEL.terminals){if(terminal.id==='extraction')continue;const [x,y]=r.w(terminal.x,terminal.y);if(x<-200||x>r.W+200)continue;const done=terminal.id==='archive'?m.archive:m.open[terminal.id];
      if(terminal.id==='archive'){
        const bob=Math.sin(t*.9)*6;glow(g,x,y-15,160,done?'#91c7b9':'#83eedd',.25);g.save();g.translate(x,y-15+bob);g.rotate(Math.sin(t*.3)*.05);path(g,[[0,-66],[36,-37],[29,39],[0,67],[-29,39],[-36,-37]]);g.fillStyle=done?'#183039':'#164d58';g.fill();g.strokeStyle=done?'#477076':'#afffdf';g.lineWidth=2;g.stroke();path(g,[[0,-66],[0,67],[29,39],[36,-37]]);g.fillStyle='#92f2d727';g.fill();line(g,-25,-35,25,35,'#bdfedf88',1);g.restore();for(let i=0;i<2;i++){g.save();g.strokeStyle='#a4edcf55';g.lineWidth=1;g.beginPath();g.ellipse(x,y-15,70+i*25,18+i*4,t*.18+i,0,TAU);g.stroke();g.restore();}
        rect(g,x-80,y+80,160,19,'#1b343b','#789d92');label(g,done?'ARCHIVE SECURE':'THE LISTENING ARCHIVE',x,y+130,done?'#91c7b9':'#d1f0dc',18);
      }else{
        glow(g,x,y,70,done?'#90dcc9':'#f9be80',.24);rect(g,x-27,y-35,54,70,'#1a3037','#778a7f');rect(g,x-19,y-25,38,33,'#061820','#426967');for(let i=0;i<3;i++)rect(g,x-12,y-17+i*8,24-(i%2)*9,3,done?'#95dfb9':'#edbd85');g.fillStyle='#a3bca5';g.beginPath();g.arc(x,y+23,6,0,TAU);g.fill();line(g,x,y+35,x,y+85,'#1c373c',7);label(g,terminal.id==='valve'?'HYDRAULIC PUMP':'LOCK CONTROL',x,y-62,'#c7c8a8',16);
      }
      if(!done&&Math.hypot(m.ship.x-terminal.x,m.ship.y-terminal.y)<130){g.save();g.strokeStyle='#d8efd0';g.setLineDash([3,7]);g.beginPath();g.arc(x,y,95,0,TAU);g.stroke();g.restore();}
    }
  }
  drawShip(r,t){
    const m=this.m,s=m.ship,g=r.ctx,[x,y]=r.w(s.x,s.y);if(Math.abs(s.vx)>20)this.face=s.vx<0?-1:1;
    this.angle+=(Math.max(-.22,Math.min(.22,s.vy*.0015*this.face))-this.angle)*.08;
    if(m.lamp){g.save();g.translate(x,y);g.rotate(this.angle);if(this.face<0)g.scale(-1,1);const grad=g.createLinearGradient(28,0,365,0);grad.addColorStop(0,'#b5fcd228');grad.addColorStop(1,'#c5fddd00');g.fillStyle=grad;path(g,[[40,-10],[365,-102],[365,105],[40,13]]);g.fill();g.restore();}
    if(m.scanning){for(let i=0;i<2;i++){const phase=(t*.65+i*.5)%1;g.save();g.globalAlpha=(1-phase)*.38;g.strokeStyle='#abf4ec';g.lineWidth=1;g.beginPath();g.arc(x,y,30+phase*640,0,TAU);g.stroke();g.restore();}}
    const scale=m.status==='extracting'?1+Math.min(.2,m.endTimer*.035):1;
    r.queue(s.x,s.y,2,ctx=>this.shipArt(ctx,x,y,t,126*scale,this.face,this.angle,false));
    if(m.archive){glow(g,x,y-50,27,'#c2f8d2',.3);g.fillStyle='#d0ffe0';path(g,[[x,y-60],[x+5,y-50],[x,y-40],[x-5,y-50]]);g.fill();}
    if(m.venting){glow(g,x-15,y-20,80,'#a5ddd3',.13);}
  }
  shipArt(g,x,y,t,width,face,angle,title){
    const m=this.m,thrust=title?.28:m.thrust,mode=title?'quiet':m.mode,height=width*831/1470;
    glow(g,x,y+25,width*.85,'#75cfc7',title?.12:.10);
    g.save();g.translate(x,y+Math.sin(t*1.9)*(title?5:1.2));g.rotate(angle);g.scale(face,1);
    if(mode!=='off'){
      const length=(.18+thrust*.8)*(width*.48)*(1+Math.sin(t*37)*.06),color=mode==='thermal'?'#ffc490':'#9ef7e5';
      for(const yy of [-height*.13,height*.20]){glow(g,-width*.43-length*.3,yy,length*.8+10,color,.35);g.save();g.globalCompositeOperation='lighter';const grad=g.createLinearGradient(-width*.43,0,-width*.43-length,0);grad.addColorStop(0,color);grad.addColorStop(1,'transparent');g.fillStyle=grad;g.beginPath();g.ellipse(-width*.43-length*.5,yy,length*.65,4+thrust*5,0,0,TAU);g.fill();g.restore();}
    }
    if(this.assets.ship){g.globalAlpha=!title&&m.invulnerable>.01&&Math.sin(t*25)>0?.6:1;g.drawImage(this.assets.ship,37,79,1470,831,-width/2,-height/2,width,height);}
    if(!title&&m.scanning){g.strokeStyle='#bdfef0';g.lineWidth=1.5;g.beginPath();g.arc(-width*.09,-height*.46,13,t*4,t*4+Math.PI*1.25);g.stroke();}
    g.restore();
  }
  titleShip(r,t){
    const portrait=r.W/r.H<.95,x=r.W*(portrait?.62:.73),y=r.H*(portrait?.79:.57),size=portrait?200:260;
    glow(r.ctx,x,y,360,'#61cfc0',.1);this.shipArt(r.ctx,x,y,t,size,1,-.05+Math.sin(t*.7)*.02,true);
    if(!portrait){label(r.ctx,'HL–07 / SALVAGE CLASS',x,y+133,'#9eb8b0',14);line(r.ctx,x-90,y+98,x+90,y+98,'#577e7745');}
  }
  atmosphere(r,t,title){
    const g=r.ctx;g.save();g.globalCompositeOperation='screen';
    for(const p of this.motes){const x=((p.x-this.game.cam.x*.25+t*p.s*.22)%(r.W+100)+r.W+100)%(r.W+100)-50,y=(p.y+t*p.s*.15)%r.H;g.globalAlpha=.10+(p.r-1)*.06;g.fillStyle='#b4dcd3';g.beginPath();g.arc(x,y,p.r,0,TAU);g.fill();}g.restore();
    const v=g.createRadialGradient(r.W*.5,r.H*.5,r.H*.18,r.W*.5,r.H*.5,Math.max(r.W*.58,r.H*.8));v.addColorStop(0,'transparent');v.addColorStop(1,'#010a13bf');g.fillStyle=v;g.fillRect(0,0,r.W,r.H);
    if(!title&&this.m.hull<40){g.fillStyle=`rgba(140,38,24,${.05+Math.sin(t*3)*.025})`;g.fillRect(0,0,r.W,r.H);}
  }
}
