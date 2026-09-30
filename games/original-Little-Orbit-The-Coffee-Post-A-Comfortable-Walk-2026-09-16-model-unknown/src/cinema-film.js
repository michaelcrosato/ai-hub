import { FILMS } from './life-spec.js';
import { HomeFilm } from './film-home.js';
/** Original local shorts. Each frame is sent to the actual cinema-screen texture. */
class PocketFilm{
 constructor(renderer){this.renderer=renderer;this.home=new HomeFilm(renderer);this.canvas=document.createElement('canvas');this.canvas.width=512;this.canvas.height=320;this.ctx=this.canvas.getContext('2d');this.select('rain');}
 select(id){this.film=FILMS.find(f=>f.id===id)||FILMS[0];this.last=-1;this.home.last=-1;}
 draw(elapsed,ended=false){if(this.film.id==='home'){this.home.draw(elapsed,ended);return;}const frame=Math.floor(elapsed*10);if(frame===this.last&&!ended)return;this.last=frame;const c=this.ctx,t=Math.min(elapsed,this.film.seconds),W=512,H=320;
  const ellipse=(x,y,rx,ry,col,angle=0)=>{c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();};
  const line=(pts,col,w=3)=>{c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
  const text=(txt,y,size=16)=>{c.fillStyle='#41564f';c.font=`${size}px Georgia`;c.textAlign='center';c.fillText(txt,256,y);};
  c.fillStyle='#f1e5cb';c.fillRect(0,0,W,H);ellipse(256,421,399,233,'#b4c59e');line([[0,238],[145,219],[260,208],[410,218],[512,238]],'#e4cc9e',18);
  let caption='';
  if(t<1.7||ended||t>this.film.seconds-.8){text(ended?'The end.':this.film.title,128,28);text(ended?'There is time for one more small story.':this.film.subtitle,160,15);text('A POCKET PICTUREHOUSE ORIGINAL',185,9);ellipse(256,228,17,17,'#c98868');}
  else if(this.film.id==='rain'){
   const calm=t>10.8,x=235+Math.sin(t*.75)*16,y=99+Math.sin(t*.8)*5;
   [[0,0,63,36],[-48,8,40,28],[48,6,43,30],[-20,-21,38,35],[20,-16,41,34]].forEach(a=>ellipse(x+a[0],y+a[1],a[2],a[3],calm?'#acb9bd':'#8d9faa'));
   const blink=t%3.7<.17;for(const s of [-1,1]){ellipse(x+s*23,y+6,4,blink?1:6,'#384a52');line([[x+s*23-9,y-10+(calm?0:s*3)],[x+s*23+9,y-10-(calm?0:s*3)]],'#485b61',3);}
   c.strokeStyle='#44565c';c.lineWidth=3;c.beginPath();if(calm)c.arc(x,y+17,9,0,Math.PI);else c.arc(x,y+34,8,Math.PI,Math.PI*2);c.stroke();
   for(let i=0;i<19;i++){const rx=x-58+(i*19)%116,ry=140+(t*75+i*17)%66;line([[rx,ry],[rx-2,ry+7]],'#8bb3b7',2);}
   const bx= t<7.5?75+(t-1.7)*15:162,by=209+Math.sin(t*6)*2;ellipse(bx,by,17,13,'#8a9f96');ellipse(bx+12,by-12,12,12,'#9daea0');ellipse(bx+17,by-15,2,2,'#354a42');line([[bx-15,by],[bx-25,by-10+Math.sin(t*8)*8]],'#5f7c79',4);
   if(t>7.5){line([[163,218],[163,171]],'#826951',3);ellipse(163,174,32,18,'#d89c7e');c.fillStyle='#f1e5cb';c.fillRect(130,175,67,11);}
   if(calm){const growth=Math.min(1,(t-10.8)/2.5);for(let i=0;i<7;i++){const fx=218+i*24,fy=218+Math.sin(i)*3;line([[fx,fy],[fx,fy-25*growth]],'#6e9068',3);ellipse(fx,fy-28*growth,6*growth,6*growth,['#e4b679','#d59c8b','#eee0b8'][i%3]);}}
   caption=t<6.8?'Some days are rain days.':t<10.8?'No need to fix the weather.':'Sometimes, company is enough.';
  }else{
   const travel=Math.min(1,(t-1.7)/10),step=t*4;const tort=(x,y,scale,col)=>{c.save();c.translate(x,y);c.scale(scale,scale);for(const s of [-1,1]){ellipse(s*13+Math.sin(step+s)*3,12,8,6,'#c3c793');}ellipse(0,0,29,18,col);ellipse(0,-5,25,17,col);line([[-17,-9],[-8,5],[8,5],[17,-9]],'#d0c493',2);ellipse(30,0,13,11,'#c2c891');ellipse(35,-3,2,3,'#415242');c.strokeStyle='#526047';c.lineWidth=1.6;c.beginPath();c.arc(34,1,4,0,Math.PI);c.stroke();c.restore();};
   tort(140+travel*143,210,1,'#819772');tort(87+travel*141,218,.78,'#97ab94');tort(48+travel*142,222+Math.sin(step)*1.4,.52,'#bea577');
   ellipse(350,230,43,9,'#d89a7c');ellipse(348,225,15,7,'#96b780');ellipse(400,239,12,4,'#796450');
   if(t>5.5&&t<8.2){const h=Math.sin((t-5.5)/2.7*Math.PI);ellipse(400,237-h*20,10,14,'#c99d73');ellipse(404,230-h*20,1.5,2,'#3e4942');}
   if(t>8.2&&t<11.2){line([[216,224],[216,204]],'#718f6b',2);ellipse(216,200,5,5,'#dcba7b');}
   caption=t<5.5?'A picnic is a very good reason to walk.':t<9?'The small things are worth a stop.':t<13?'We wait for the smallest feet.':'Arriving together is the best part.';
  }
  if(caption){c.fillStyle='#f4e9d1';c.fillRect(12,258,488,33);text(caption,280,16);}
  c.fillStyle='#425e54';c.fillRect(0,0,512,15);c.fillRect(0,305,512,15);for(let x=8;x<512;x+=28){c.fillStyle='#e8d9b6';c.fillRect(x,4,11,6);c.fillRect(x,309,11,6);}
  this.renderer.updateTexture('pocket-film',this.canvas);
 }
}

export { PocketFilm };
