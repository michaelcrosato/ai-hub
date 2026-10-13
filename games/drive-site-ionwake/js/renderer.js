/* IONWAKE perspective extension. Original mesh renderer for my-3D2dge. */
(() => {
  'use strict';
  const E = My3D2dge, TAU = Math.PI * 2;
  const rgbCache = new Map();
  function rgb(c) { if (!rgbCache.has(c)) rgbCache.set(c, [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]); return rgbCache.get(c); }
  function mix(a,b,t,light=1) { const p=rgb(a),q=rgb(b),k=E.clamp(t,0,1); return `rgb(${Math.round(p[0]*light*(1-k)+q[0]*k)},${Math.round(p[1]*light*(1-k)+q[1]*k)},${Math.round(p[2]*light*(1-k)+q[2]*k)})`; }
  function noise(n) { const k=Math.sin(n*127.1+19.7)*43758.5453123; return k-Math.floor(k); }
  function clip(points, near) {
    const out=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length],ai=a[2]>=near,bi=b[2]>=near;
      if(ai) out.push(a);
      if(ai!==bi) { const t=(near-a[2])/(b[2]-a[2]);out.push([E.lerp(a[0],b[0],t),E.lerp(a[1],b[1],t),near]); }
    } return out;
  }
  class Perspective {
    constructor() { this.items=[]; this.faces=0; this.W=1280;this.H=720;this.f=620;this.cam={x:0,y:26,z:0};this.renderStats={faces:0,items:0}; }
    begin(g,W,H,cam,time,phase='approach') {
      this.g=g;this.W=W;this.H=H;this.cam=cam;this.time=time;this.phase=phase;this.f=H*.92;this.cx=W*.5;this.cy=H*.43;this.items.length=0;this.faces=0;
      this.cos=Math.cos(cam.bank||0);this.sin=Math.sin(cam.bank||0);this.fog=phase==='boss'?'#b8aa93':'#c2b9a0';
      const grad=g.createLinearGradient(0,0,0,H*.64);grad.addColorStop(0,'#527782');grad.addColorStop(.52,'#b8bca7');grad.addColorStop(1,'#ebc5a2');g.fillStyle=grad;g.fillRect(0,0,W,H);
      const sunX=W*.73-cam.x*1.25,sunY=H*.23+Math.sin(time*.008)*H*.025,rad=H*.09;
      const halo=g.createRadialGradient(sunX,sunY,rad*.4,sunX,sunY,rad*3.4);halo.addColorStop(0,'#ffc28f60');halo.addColorStop(1,'#ffd29700');g.fillStyle=halo;g.fillRect(sunX-rad*3.4,sunY-rad*3.4,rad*6.8,rad*6.8);
      g.fillStyle='#e8976a';g.beginPath();g.arc(sunX,sunY,rad,0,TAU);g.fill();
      g.strokeStyle='#f5d3a15e';g.lineWidth=1;g.beginPath();g.ellipse(sunX,sunY,rad*1.65,rad*.28,-.38,0,TAU);g.stroke();
      for(let j=0;j<4;j++) { const y=H*(.25+j*.033),x=-W*.1+((j*330+time*.55)% (W*1.2));g.fillStyle='#fff4cd12';g.beginPath();g.moveTo(x,y);g.lineTo(x+W*.28,y-2);g.lineTo(x+W*.45,y+4);g.lineTo(x+W*.05,y+7);g.fill(); }
      for(let layer=0;layer<3;layer++) {
        g.fillStyle=['#839c98','#71918b','#678e85'][layer];g.beginPath();g.moveTo(0,H*.5);
        for(let x=-40;x<=W+80;x+=45) { const yy=H*(.435-layer*.002)-noise(Math.floor(x/45)+layer*29)*H*(.025+layer*.008);g.lineTo(x,yy); }g.lineTo(W,H*.58);g.lineTo(0,H*.58);g.closePath();g.fill();
      }
      const sea=g.createLinearGradient(0,H*.42,0,H);sea.addColorStop(0,'#708f87');sea.addColorStop(.35,'#327277');sea.addColorStop(1,'#173f52');g.fillStyle=sea;g.fillRect(0,H*.465,W,H);
    }
    project(x,y,z) {const c=this.cam,d=z-c.z;if(d<2)return null;const px=(x-c.x)*this.f/d,py=-(y-c.y)*this.f/d;return {x:this.cx+px*this.cos-py*this.sin,y:this.cy+px*this.sin+py*this.cos,z:d,s:this.f/d};}
    unproject(sx,sy,z) {const d=z-this.cam.z,px=sx-this.cx,py=sy-this.cy;return{x:this.cam.x+(px*this.cos+py*this.sin)*d/this.f,y:this.cam.y-(-px*this.sin+py*this.cos)*d/this.f,z};}
    face(pts,c,o={}) {
      const cam=this.cam;let q=pts.map(p=>[p[0]-cam.x,p[1]-cam.y,p[2]-cam.z]);
      if(q.every(p=>p[2]<3)||q.every(p=>p[2]>2100))return;q=clip(q,3);if(q.length<3)return;
      const d=q.reduce((n,p)=>n+p[2],0)/q.length;const pp=q.map(p=>{const x=p[0]*this.f/p[2],y=-p[1]*this.f/p[2];return[this.cx+x*this.cos-y*this.sin,this.cy+x*this.sin+y*this.cos];});
      if(pp.every(p=>p[0]<-4)||pp.every(p=>p[0]>this.W+4)||pp.every(p=>p[1]<-4)||pp.every(p=>p[1]>this.H+4))return;
      const fog=o.noFog?0:E.clamp((d-120)/1550,0,.93);const color=mix(c,this.fog,fog,o.light||1);
      this.items.push({kind:0,p:pp,z:d+(o.bias||0),c:color,alpha:o.alpha??1,glow:o.glow,stroke:o.stroke});this.faces++;
    }
    mesh(model,x,y,z,o={}) {
      if(!model)return;const p=this.project(x,y,z);if(!p||p.z>1900)return;
      const s=o.scale||1,sz=Array.isArray(s)?s:[s,s,s],cy=Math.cos(o.yaw||0),sy=Math.sin(o.yaw||0),cr=Math.cos(o.roll||0),sr=Math.sin(o.roll||0),cp=Math.cos(o.pitch||0),sp=Math.sin(o.pitch||0);
      const v=model.vertices.map(a=>{let xx=a[0]*sz[0],yy=a[1]*sz[1],zz=a[2]*sz[2];[yy,zz]=[yy*cp-zz*sp,yy*sp+zz*cp];[xx,zz]=[xx*cy+zz*sy,-xx*sy+zz*cy];return[xx*cr-yy*sr+x,xx*sr+yy*cr+y,zz+z];});
      for(const f of model.faces) {const pts=f.v.map(i=>v[i]);const a=pts[0],b=pts[1],c=pts[2],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];if(n[0]*(this.cam.x-a[0])+n[1]*(this.cam.y-a[1])+n[2]*(this.cam.z-a[2])<=0)continue;let light=1;if(!f.glow&&!o.unlit) {const len=Math.hypot(...n)||1;light=.73+.27*Math.abs((n[0]*-.4+n[1]*.7+n[2]*-.5)/len);}
        this.face(pts,o.flash?'#fff7d6':(o.tint||f.c),{light,glow:f.glow,alpha:o.alpha??1,noFog:o.noFog});}
    }
    box(x,y,z,w,h,d,c,top) {
      const a=x-w/2,b=x+w/2,l=y-h/2,u=y+h/2,n=z-d/2,f=z+d/2;
      this.face([[a,l,n],[b,l,n],[b,u,n],[a,u,n]],c);this.face([[a,u,n],[b,u,n],[b,u,f],[a,u,f]],top||c,{light:1.1});
      this.face([[a,l,n],[a,u,n],[a,u,f],[a,l,f]],c,{light:.72});this.face([[b,l,n],[b,l,f],[b,u,f],[b,u,n]],c,{light:.85});
    }
    line(a,b,c,width=1,alpha=1) {const p=this.project(...a),q=this.project(...b);if(!p||!q)return;this.items.push({kind:1,p,q,z:(p.z+q.z)*.5,c,width,alpha});}
    glow(x,y,z,size,c,alpha=1) {const p=this.project(x,y,z);if(!p||p.x<-100||p.x>this.W+100||p.y<-100||p.y>this.H+100)return;this.items.push({kind:2,p,z:p.z,c,size:Math.min(300,size*p.s),alpha});}
    ring(x,y,z,r,c,rot=0,thickness=.9) {const n=16;for(let i=0;i<n;i++){const a=i/n*TAU+rot,b=(i+1)/n*TAU+rot;this.face([[x+Math.cos(a)*r,y+Math.sin(a)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z],[x+Math.cos(b)*(r-thickness),y+Math.sin(b)*(r-thickness),z-.2],[x+Math.cos(a)*(r-thickness),y+Math.sin(a)*(r-thickness),z-.2]],c,{noFog:false});}}
    scenery(distance,phase,route) {
      const step=95,start=Math.floor((distance-160)/step);const colors=['#377979','#387e7e','#3f8380','#2d7177','#4b8c85'];
      const bend=z=>Math.sin(z*.0012)*26;
      for(let k=start;k<start+23;k++) {
        const z=k*step,z2=z+step,center=bend(z),center2=bend(z2);
        for(let j=0;j<6;j++) {const x=(j-3)*76+center,x2=x+76,wa=Math.sin(k*1.7+j*.8+this.time*1.4)*.7,wb=Math.cos(k*.9+j+this.time*.8)*.8;
          this.face([[x,-7+wa,z],[x2,-7+wb,z],[x2+(center2-center),-7,z2]],colors[(Math.abs(k+j*3))%colors.length]);
          this.face([[x,-7+wa,z],[x2+(center2-center),-7,z2],[x+(center2-center),-7,z2]],colors[(Math.abs(k+j*2+2))%colors.length]);
          if(j>=2&&j<=4&&noise(k*17+j)>.48) {let xx=x+noise(k+j*70)*65,zz=z+noise(k+j*30)*70;this.face([[xx,-5.95,zz],[xx+13,-5.95,zz],[xx+34,-5.95,zz+1.9],[xx+3,-5.95,zz+1.7]],'#b6c69d',{alpha:.32});}
        }
        const tight=route==='cut'&&phase==='route';
        for(let side of [-1,1]) {
          const nn=noise(k*3+side*17),nn2=noise((k+1)*3+side*17),inner=tight?57:88;
          const x=side*(inner+nn*65)+center,xn=side*(inner+nn2*65)+center2,h=30+nn*90,hn=30+nn2*90;
          const a=[x,-6,z],b=[xn,-6,z2],c=[xn+side*34,hn,z2],d=[x+side*34,h,z];
          this.face([a,b,c],side>0?'#b87856':'#bf8860');this.face([a,c,d],side>0?'#c48b62':'#ce966c');
          this.face([d,c,[xn+side*145,hn-9,z2],[x+side*150,h-11,z]],'#dfab78');
          this.face([[x,-5.7,z],[xn,-5.7,z2],[xn-side*5,-5.7,z2],[x-side*5,-5.7,z]],'#8fb8a0',{alpha:.75});
          if(k%3===0) {const px=side*(inner+nn*26)+center,pz=z+28;this.box(px,3,pz,17,19,27,'#28484d','#56716a');this.box(px,20,pz,2,23,2,'#3a595b');
            this.face([[px-18,30,pz-9],[px+18,30,pz-9],[px+18,39,pz+10],[px-18,39,pz+10]],'#263f4b');
            for(let t=0;t<4;t++)this.line([px-18+t*12,30,pz-9],[px-18+t*12,39,pz+10],'#82b3ac',.7,.5);
            this.line([px-18,34.5,pz+.5],[px+18,34.5,pz+.5],'#82b3ac',.6,.5);
          }
          if(k%7===3) {let px=side*68+center;this.box(px,47,z+60,5,102,5,'#566a60','#c5b78b');this.glow(px,99,z+60,1.4,'#ffa56d',.8);}
        }
        if((k+2)%8===0) {
          this.box(-67+bend(z),28,z,9,69,13,'#3c5d5b','#b6b997');this.box(67+bend(z),28,z,9,69,13,'#3c5d5b','#b6b997');this.box(bend(z),59,z,142,5,15,'#71877b','#c0c4a0');
          this.line([-62+bend(z),55,z-8],[62+bend(z),55,z-8],'#8ddbb7',2,.8);
        }
      }
      // Small distant gliders give a scale reference without adding combat noise.
      for(let i=0;i<7;i++){const z=distance+500+i*120,x=Math.sin(this.time*.14+i*7)*70,y=70+Math.sin(this.time*.9+i)*4;this.line([x-3,y,z],[x,y-1.5,z+2],'#455f59',1,.65);this.line([x,y-1.5,z+2],[x+3,y,z],'#455f59',1,.65);}
    }
    exhaust(x,y,z,intensity=1,wide=1) {this.glow(x,y,z,2.3*wide,'#62ffd1',.8);this.glow(x,y,z-3.2*intensity,.8*wide,'#e9fff1',.9);const pts=[[x-1.15*wide,y,z],[x+1.15*wide,y,z],[x,y-.3,z-9*intensity]];this.face(pts,'#6cf4d2',{alpha:.6,noFog:true});}
    finish() {
      const g=this.g;this.items.sort((a,b)=>b.z-a.z);g.save();g.lineJoin='round';
      for(const it of this.items) {
        g.globalAlpha=it.alpha??1;
        if(it.kind===0) {g.fillStyle=it.c;g.beginPath();g.moveTo(it.p[0][0],it.p[0][1]);for(let j=1;j<it.p.length;j++)g.lineTo(it.p[j][0],it.p[j][1]);g.closePath();g.fill();if(it.alpha>.96){g.strokeStyle=it.c;g.lineWidth=.55;g.stroke();}}
        else if(it.kind===1) {g.strokeStyle=it.c;g.lineWidth=it.width;g.beginPath();g.moveTo(it.p.x,it.p.y);g.lineTo(it.q.x,it.q.y);g.stroke();}
        else {const r=Math.max(.8,it.size);g.globalCompositeOperation='lighter';const grad=g.createRadialGradient(it.p.x,it.p.y,0,it.p.x,it.p.y,r);grad.addColorStop(0,it.c);grad.addColorStop(.2,it.c+'c0');grad.addColorStop(1,it.c+'00');g.fillStyle=grad;g.fillRect(it.p.x-r,it.p.y-r,r*2,r*2);g.globalCompositeOperation='source-over';}
      }g.restore();g._c=null;this.renderStats={faces:this.faces,items:this.items.length};
    }
  }
  window.IonRenderer=Perspective;
  window.IonMath={noise,clipNear:clip};
})();
