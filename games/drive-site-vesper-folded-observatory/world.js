/* VESPER world and simulation. Original game code. Uses my-3d2dge physics. */
(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const mod=(n,m)=>((n%m)+m)%m;
  const data=[
    ['arrival',-112,0,0,120,80,'Arrival garden'],
    ['step',-40,0,26,44,44,'First steps'],
    ['turn',8,0,52,40,40,'The hidden path'],
    ['dawn',8,-62,78,32,36,'Dawn lens'],
    ['crossing',8,-114,104,40,42,'The long crossing'],
    ['garden',70,-114,130,46,34,'Hanging garden'],
    ['tide',128,-114,156,46,44,'Tide lens'],
    ['passage',128,-48,182,36,42,'The folded passage'],
    ['dusk',128,14,208,50,44,'Dusk lens'],
    ['ascent',64,14,234,44,34,'The last ascent'],
    ['roof',0,14,260,70,60,'Observatory roof']
  ];
  const platforms=data.map((p,i)=>({id:p[0],x:p[1],y:p[2],top:p[3],w:p[4],d:p[5],name:p[6],i,h:6}));
  const lenses=[{id:0,platform:'dawn',face:1,name:'Dawn',symbol:'◒',color:'#f1c77b'},{id:1,platform:'tide',face:2,name:'Tide',symbol:'◇',color:'#82dfd4'},{id:2,platform:'dusk',face:3,name:'Dusk',symbol:'✳',color:'#c6b8f2'}];
  const stars=[{id:0,platform:'step',offset:-8},{id:1,platform:'crossing',offset:7},{id:2,platform:'garden',offset:0},{id:3,platform:'passage',offset:0},{id:4,platform:'ascent',offset:0},{id:5,platform:'roof',offset:23}];
  const faces=['NORTH','EAST','SOUTH','WEST'];
  const at=id=>platforms.find(p=>p.id===id);
  function basis(face){const a=face*Math.PI/2;return {c:Math.round(Math.cos(a)),s:Math.round(Math.sin(a))};}
  function project(x,y,face){const {c,s}=basis(face);return {u:x*c-y*s,d:x*s+y*c};}
  function unproject(u,d,face){const {c,s}=basis(face);return {x:u*c+d*s,y:-u*s+d*c};}
  function collider(p,face){const {c,s}=basis(face),q=project(p.x,p.y,face);return {x:q.u,z:p.top-p.h,w:Math.abs(c)*p.w+Math.abs(s)*p.d,h:p.h,depth:q.d,depthWidth:Math.abs(s)*p.w+Math.abs(c)*p.d,source:p};}
  function saveValid(s){return s&&s.version===1&&Array.isArray(s.lenses)&&Array.isArray(s.stars)&&at(s.checkpoint?.id)&&Number.isFinite(s.checkpoint.face);}
  class Simulation{
    constructor(E,saved=null){
      this.E=E;this.map=new E.PlatformMap({rows:['.'],legend:{},types:{},edges:'open'});
      this.hero=new E.Platformer({x:-140,z:0,w:8,h:16,run:83,accel:720,decel:960,airAccel:610,jump:230,gravity:620,fallGravity:780,maxFall:330,coyote:.12,buffer:.15});
      this.face=0;this.yaw=0;this.turn=null;this.world={x:-140,y:22};this.lit=new Set();this.found=new Set();this.visited=new Set(['arrival']);this.secret=false;this.complete=false;this.elapsed=0;this.turns=0;this.falls=0;this.events=[];this.safeTimer=0;this.lastPlatform='arrival';this.highest=0;this.checkpoint={id:'arrival',face:0};this.assist=false;this.reduceMotion=false;this.endingTime=0;
      if(saveValid(saved)){this.lit=new Set(saved.lenses.filter(i=>[0,1,2].includes(i)));this.found=new Set(saved.stars.filter(i=>Number.isInteger(i)&&i>=0&&i<6));this.secret=!!saved.secret;this.complete=!!saved.complete&&this.lit.size===3;this.elapsed=clamp(Number(saved.elapsed)||0,0,1e7);this.turns=clamp(Number(saved.turns)||0,0,1e7);this.falls=clamp(Number(saved.falls)||0,0,1e7);this.highest=clamp(Number(saved.highest)||0,0,10);this.visited=new Set(Array.isArray(saved.visited)?saved.visited.filter(id=>at(id)):platforms.filter(p=>p.i<=this.highest).map(p=>p.id));this.visited.add('arrival');this.checkpoint={id:saved.checkpoint.id,face:mod(Math.round(saved.checkpoint.face),4)};this.restore(false);}else{this.rebuild();this.hero.onGround=true;this.hero.ground=this.solids.find(s=>s.source.id==='arrival');}
    }
    emit(type,data={}){this.events.push({type,...data});}
    rebuild(){this.solids=platforms.map(p=>collider(p,this.face)).sort((a,b)=>b.depth-a.depth);}
    requestTurn(dir){if(this.turn||!Number.isFinite(dir)||!dir)return false;const delta=dir>0?1:-1;this.turn={from:this.yaw,to:this.yaw+delta*90,t:0,duration:this.reduceMotion?.13:.52};this.hero.vx=0;this.turns++;this.emit('turn',{dir:delta});return true;}
    finishTurn(){const target=this.turn.to;this.face=mod(Math.round(target/90),4);this.yaw=target;this.turn=null;this.rebuild();this.hero.x=project(this.world.x,this.world.y,this.face).u;this.hero.ground=null;this.hero.onGround=false;this.map._probe(this.hero,this.solids);this.resolveOverlap();this.emit('turned');}
    resolveOverlap(){
      const b=this.hero;const hits=this.solids.filter(s=>Math.abs(b.x-s.x)*2<b.w+s.w-.1&&b.z<s.z+s.h-.1&&b.z+b.h>s.z+.1);
      if(!hits.length)return;
      let choices=[];
      for(const s of hits){choices.push(s.x-(s.w+b.w)/2-.2,s.x+(s.w+b.w)/2+.2);}
      choices.sort((a,c)=>Math.abs(a-b.x)-Math.abs(c-b.x));
      const free=choices.find(x=>!this.solids.some(s=>Math.abs(x-s.x)*2<b.w+s.w-.1&&b.z<s.z+s.h-.1&&b.z+b.h>s.z+.1));
      if(free!==undefined){b.x=free;const old=project(this.world.x,this.world.y,this.face);this.world=unproject(b.x,old.d,this.face);this.emit('shift');}
    }
    step(dt,ctl){
      this.elapsed+=dt;if(this.endingTime>0)this.endingTime+=dt;
      if(this.turn){this.turn.t+=dt;const p=clamp(this.turn.t/this.turn.duration,0,1),e=p*p*(3-2*p);this.yaw=this.turn.from+(this.turn.to-this.turn.from)*e;if(p>=1)this.finishTurn();return;}
      const oldDepth=project(this.world.x,this.world.y,this.face).d;
      this.hero.jump=this.assist?258:230;this.hero.run=this.assist?89:83;
      this.hero.update(dt,this.map,ctl,this.solids);
      let depth=oldDepth;
      if(this.hero.onGround&&this.hero.ground){const s=this.hero.ground;depth=clamp(depth,s.depth-s.depthWidth/2+2,s.depth+s.depthWidth/2-2);this.lastPlatform=s.source.id;this.visited.add(s.source.id);this.highest=Math.max(this.highest,s.source.i);this.safeTimer+=dt;if(this.safeTimer>.24&&(this.checkpoint.id!==s.source.id||this.checkpoint.face!==this.face)){this.checkpoint={id:s.source.id,face:this.face};this.emit('checkpoint');}}
      else this.safeTimer=0;
      this.world=unproject(this.hero.x,depth,this.face);
      if(this.hero.jumped)this.emit('jump');if(this.hero.landed)this.emit('land');
      for(const star of stars){if(this.found.has(star.id))continue;const p=at(star.platform),q=project(p.x+star.offset,p.y,this.face);if(Math.abs(this.hero.x-q.u)<14&&Math.abs(this.hero.z+8-(p.top+10))<17){this.found.add(star.id);this.emit('star',{id:star.id,x:p.x+star.offset,y:p.y,z:p.top+12});}}
      const safe=at(this.checkpoint.id);if(this.hero.z<Math.max(-65,safe.top-100)||Math.abs(this.hero.x)>340){this.falls++;this.restore();}
    }
    nearby(){if(this.turn||!this.hero.onGround)return null;for(const lens of lenses){const p=at(lens.platform),q=project(p.x,p.y,this.face);if(Math.abs(this.hero.x-q.u)<24&&Math.abs(this.hero.z-p.top)<3)return {type:'lens',lens,platform:p};}const roof=at('roof'),q=project(roof.x,roof.y,this.face);if(Math.abs(this.hero.x-q.u)<34&&Math.abs(this.hero.z-roof.top)<3)return {type:'beacon',platform:roof};return null;}
    interact(){const near=this.nearby();if(!near)return {ok:false,message:'Stand near a lens or the roof beacon.'};if(near.type==='lens'){const l=near.lens;if(this.lit.has(l.id))return {ok:false,message:l.name+' lens is awake.'};if(this.face!==l.face)return {ok:false,message:'Turn to '+faces[l.face]+' to join the broken ring.'};this.lit.add(l.id);this.checkpoint={id:l.platform,face:this.face};this.emit('lens',{lens:l});return {ok:true,type:'lens',id:l.id};}if(this.lit.size<3)return {ok:false,message:'The roof needs all three lenses. Check your map.'};if(this.face===2&&!this.secret){this.secret=true;this.emit('secret');return {ok:true,type:'secret'};}if(this.face!==0)return {ok:false,message:'Face NORTH to send the light into the sky.'};if(!this.complete){this.complete=true;this.endingTime=.001;this.emit('complete');return {ok:true,type:'complete'};}return {ok:false,message:'The sky remembers. Your journey is complete.'};}
    restore(notify=true){const p=at(this.checkpoint.id)||platforms[0];this.face=mod(this.checkpoint.face,4);this.yaw=this.face*90;this.turn=null;this.world={x:p.x,y:p.y};this.rebuild();Object.assign(this.hero,{x:project(p.x,p.y,this.face).u,z:p.top,vx:0,vz:0,onGround:true,ground:this.solids.find(s=>s.source.id===p.id),climbing:false,dashing:0,drop:0,stun:0,_coy:0,_cut:true,air:false});this.lastPlatform=p.id;this.safeTimer=0;if(notify)this.emit('restore');}
    travel(id){const l=lenses.find(l=>l.platform===id);if(id!=='arrival'&&!(id==='roof'&&this.complete)&&!(l&&this.lit.has(l.id)))return false;this.checkpoint={id,face:l?l.face:0};this.restore();this.emit('travel');return true;}
    snapshot(){return {version:1,lenses:[...this.lit],stars:[...this.found],visited:[...this.visited],secret:this.secret,complete:this.complete,elapsed:Math.round(this.elapsed*10)/10,turns:this.turns,falls:this.falls,highest:this.highest,checkpoint:{...this.checkpoint}};}
  }
  root.VesperCore={Simulation,platforms,lenses,stars,faces,at,basis,project,unproject,collider,saveValid,clamp,mod};
})(typeof window!=='undefined'?window:globalThis);
