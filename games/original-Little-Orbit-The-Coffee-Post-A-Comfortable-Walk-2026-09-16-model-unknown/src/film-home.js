/** Small original 14-second film, drawn on the actual 3D cinema screen.
 * A 512 x 320 canvas updates at eight frames per second, only while viewing. */
class HomeFilm {
 constructor(renderer){this.renderer=renderer;this.canvas=document.createElement('canvas');this.canvas.width=512;this.canvas.height=320;this.ctx=this.canvas.getContext('2d');this.last=-1;}
 draw(elapsed,ended=false){
  const frame=Math.floor(elapsed*8);if(frame===this.last&&!ended)return;this.last=frame;
  const c=this.ctx,w=512,h=320,t=Math.min(elapsed,14);c.clearRect(0,0,w,h);c.fillStyle='#eee1c2';c.fillRect(0,0,w,h);
  const circle=(x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
  const line=(a,b,color,width)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();};
  // Paper border and small sprocket holes make the live screen read as a film.
  c.fillStyle='#455f55';c.fillRect(0,0,512,17);c.fillRect(0,303,512,17);for(let x=9;x<512;x+=28){c.fillStyle='#eee1c2';c.fillRect(x,5,12,7);c.fillRect(x,308,12,7);}
  if(t<1.6||ended||t>=13.7){
   c.fillStyle='#425d52';c.textAlign='center';c.font='italic 31px Georgia';c.fillText(ended||t>=13.7?'The path goes on.':'The Long Way Home',256,142);c.font='11px sans-serif';c.fillText(ended||t>=13.7?'A SMALL FILM · MADE FOR LITTLE ORBIT':'A POCKET PICTUREHOUSE FILM',256,171);
   circle(256,217,18,'#c88d63');c.fillStyle='#eee1c2';c.beginPath();c.ellipse(256,220,11,5,-.4,0,Math.PI*2);c.fill();
  }else{
   const phase=t<5.5?0:t<9.5?1:2;
   circle(413,69,23,'#dbb46e');circle(380,81,17,'#eee1c2');
   // Curved ground, paths, and scenery are part of the animated film, not game assets.
   c.fillStyle='#aebd92';c.beginPath();c.ellipse(256,422,390,230,0,0,Math.PI*2);c.fill();
   c.strokeStyle='#e3ca95';c.lineWidth=23;c.beginPath();c.moveTo(0,250);c.quadraticCurveTo(256,173,512,245);c.stroke();
   for(let i=0;i<3;i++){const x=48+i*181;line([x,192],[x,143],'#9e7d57',7);circle(x,129,24,['#9baa82','#b3bd83','#94aa85'][i]);}
   if(phase===0){const grow=Math.min(1,(t-1.6)/2.0);line([322,204],[322,204-grow*45],'#617e60',3);c.fillStyle='#719371';c.beginPath();c.ellipse(310,187,14*grow,5*grow,-.4,0,Math.PI*2);c.fill();circle(322,204-grow*49,9*grow,'#d5a478');}
   if(phase===1){c.fillStyle='#d29b80';c.fillRect(324,120,71,65);c.fillStyle='#b27157';c.beginPath();c.moveTo(314,120);c.lineTo(361,87);c.lineTo(405,120);c.closePath();c.fill();c.fillStyle='#eee1c2';c.fillRect(340,137,19,19);c.fillStyle='#688974';c.fillRect(370,151,14,34);}
   const x=155+(phase===0?(t-1.6)*20:phase===1?(t-5.5)*18:(t-9.5)*22),y=195+Math.sin(t*7)*2;
   // Readable courier: a round head, two ears, cream muzzle, green bag, and tray.
   c.fillStyle='#5f806c';c.fillRect(x-22,y-26,20,29);circle(x,y-16,20,'#cd905f');
   circle(x-12,y-62,10,'#cd905f');circle(x+12,y-62,10,'#cd905f');circle(x,y-48,27,'#dba169');
   c.fillStyle='#f9eacd';c.beginPath();c.ellipse(x+6,y-39,18,11,0,0,Math.PI*2);c.fill();circle(x+5,y-53,2.4,'#4b4639');circle(x+21,y-51,2.4,'#4b4639');
   c.strokeStyle='#4b4639';c.lineWidth=2;c.beginPath();c.arc(x+14,y-42,4,0,Math.PI);c.stroke();line([x-10,y+3],[x-15+Math.sin(t*7)*5,y+13],'#b58058',10);line([x+7,y+3],[x+12-Math.sin(t*7)*5,y+13],'#b58058',10);
   line([x+10,y-12],[x+39,y-12],'#956c4e',5);for(let i=0;i<2;i++){c.fillStyle='#fff1d4';c.fillRect(x+12+i*15,y-24,9,12);c.fillStyle='#c99870';c.fillRect(x+13+i*15,y-19,7,4);}
   c.fillStyle='#405b4e';c.textAlign='center';c.font='italic 17px Georgia';c.fillText(['We leave something growing.','We make something to share.','We take the long way home.'][phase],256,278);
  }
  this.renderer.updateTexture('pocket-film',this.canvas);
 }
}

export { HomeFilm };
