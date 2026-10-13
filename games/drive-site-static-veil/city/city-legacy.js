/* Depth-tested perspective renderer for the existing Meridian world. The
 * supplied engine still owns input, movement, collision, sound, and the loop. */
(function(root){
 'use strict';
 const C=root.MeridianCamera,M=root.Meridian;
 const VERT=`attribute vec3 aPosition;attribute vec3 aColor;attribute float aGlow;
 uniform mat4 uMatrix;uniform vec3 uEye;varying vec3 vColor;varying float vGlow;varying float vDistance;varying float vHeight;
 void main(){gl_Position=uMatrix*vec4(aPosition-uEye,1.0);vColor=aColor;vGlow=aGlow;vDistance=length(aPosition-uEye);vHeight=aPosition.z;}`;
 const FRAG=`precision mediump float;varying vec3 vColor;varying float vGlow;varying float vDistance;varying float vHeight;uniform float uFog;
 void main(){float mist=1.0-exp(-pow(vDistance/uFog,1.65));vec3 haze=mix(vec3(.055,.13,.19),vec3(.035,.078,.13),clamp(vHeight/550.0,0.0,1.0));vec3 c=vColor*(.88+vGlow*.55)+vColor*vGlow*.08;float grain=mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),2.0)*.012;gl_FragColor=vec4(mix(c,haze,clamp(mist,0.0,.96))+grain,1.0);}`;
 const SKYVERT=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,1.0,1.0);}`;
 const SKYFRAG=`precision mediump float;varying vec2 vUV;uniform float uPitch;void main(){float h=clamp(vUV.y*.8+uPitch*.22,0.0,1.0);vec3 c=mix(vec3(.16,.23,.27),vec3(.018,.045,.085),smoothstep(.0,1.0,h));float band=exp(-pow((vUV.y-.38-uPitch*.09)*6.0,2.0));c+=vec3(.055,.025,.035)*band;gl_FragColor=vec4(c,1.0);}`;
 function program(gl,vs,fs){
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
 }
 class Renderer{
  constructor(options={}){
   this.canvas=document.createElement('canvas');this.gl=null;
   try{if(!options.forceSoftware)this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(_){}
   this.camera=new C.Camera();this.cache=new Map();this.maxCache=420;this.city=null;this.floorMesh=null;this.stats={};this.lost=false;
   this.backend=this.gl?'webgl':'software';
   if(!this.gl){this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d',{alpha:false});this.surface=new root.MeridianRaster.Surface(400,250);return;}
   const gl=this.gl;this.program=program(gl,VERT,FRAG);this.sky=program(gl,SKYVERT,SKYFRAG);
   this.attributes={position:gl.getAttribLocation(this.program,'aPosition'),color:gl.getAttribLocation(this.program,'aColor'),glow:gl.getAttribLocation(this.program,'aGlow')};
   this.uniforms={matrix:gl.getUniformLocation(this.program,'uMatrix'),eye:gl.getUniformLocation(this.program,'uEye'),fog:gl.getUniformLocation(this.program,'uFog')};
   this.skyAttribute=gl.getAttribLocation(this.sky,'aPosition');this.skyPitch=gl.getUniformLocation(this.sky,'uPitch');
   this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
   this.dynamic=gl.createBuffer();
   this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
  }
  dispose(){if(this.gl){for(const m of this.cache.values())this.gl.deleteBuffer(m.buffer);if(this.floorMesh)this.gl.deleteBuffer(this.floorMesh.buffer);this.gl.deleteBuffer(this.dynamic);this.gl.deleteBuffer(this.skyBuffer);this.gl.deleteProgram(this.program);this.gl.deleteProgram(this.sky);}this.cache.clear();this.floorMesh=null;}
  reset(city){if(this.city===city)return;if(this.gl){for(const m of this.cache.values())this.gl.deleteBuffer(m.buffer);if(this.floorMesh)this.gl.deleteBuffer(this.floorMesh.buffer);}this.cache.clear();this.floorMesh=null;this.city=city;}
  upload(mesh){if(!this.gl)return{mesh,count:mesh.vertices.length/7,triangles:mesh.vertices.length/21,bounds:mesh.bounds};const gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);return{buffer:b,count:mesh.vertices.length/7,triangles:mesh.vertices.length/21,bounds:mesh.bounds};}
  bind(buffer){const g=this.gl,a=this.attributes;g.bindBuffer(g.ARRAY_BUFFER,buffer);for(const n of Object.values(a))g.enableVertexAttribArray(n);g.vertexAttribPointer(a.position,3,g.FLOAT,false,28,0);g.vertexAttribPointer(a.color,3,g.FLOAT,false,28,12);g.vertexAttribPointer(a.glow,1,g.FLOAT,false,28,24);}
  mesh(m){if(!m||!m.count)return;if(this.gl){this.bind(m.buffer);this.gl.drawArrays(this.gl.TRIANGLES,0,m.count);}else this.surface.draw(m.mesh,this.camera,{fog:this.fog});this.stats.triangles+=m.count/3;this.stats.draws++;}
  dynamicMesh(mesh){if(!mesh?.vertices?.length)return;if(this.gl){const gl=this.gl;this.bind(this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,mesh.vertices.length/7);}else this.surface.draw(mesh,this.camera,{fog:this.fog});this.stats.triangles+=mesh.vertices.length/21;this.stats.draws++;}
  render(state,width,height){
   if(this.lost)throw new Error('The perspective graphics context was lost');
   const gl=this.gl,geo=root.MeridianMesh,city=state.city,body=state.body;this.reset(city);
   if(!gl){const scale=Math.min(1,460/width,290/height);width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));}
   if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
   this.camera.resize(width,height);this.fog=this.fogEnabled===false?0:380+body.z*.7;
   if(gl){gl.viewport(0,0,width,height);gl.clearColor(.025,.055,.085,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.useProgram(this.sky);
   for(const n of Object.values(this.attributes))gl.disableVertexAttribArray(n);
   gl.enableVertexAttribArray(this.skyAttribute);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.vertexAttribPointer(this.skyAttribute,2,gl.FLOAT,false,0,0);gl.uniform1f(this.skyPitch,-this.camera.forward[2]);gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(this.skyAttribute);
   gl.useProgram(this.program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.uniformMatrix4fv(this.uniforms.matrix,false,this.camera.matrix(true));gl.uniform3fv(this.uniforms.eye,this.camera.eye);gl.uniform1f(this.uniforms.fog,this.fog);
   }else{this.surface.resize(width,height);this.surface.clear(this.camera);}
   this.stats={backend:this.backend,triangles:0,draws:0,blocks:0,detailedBlocks:0,cache:0,width,height};
   const bx=Math.floor(body.x/M.BLOCK),by=Math.floor(body.y/M.BLOCK),radius=Math.min(9,5+Math.floor(body.z/90));
   const roofIds=state.plan?.roof&&!state.exterior?state.layer.buildings.map(b=>b.id):[];
   const cut={buildingId:state.exterior?null:state.building?.id||null,floorZ:state.plan?.z??null,roofIds,eye:state.mode==='eye'};
   const cutKey=JSON.stringify(cut),used=new Set();
   for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    const x=bx+dx,y=by+dy;if(x<0||y<0||x>=city.n||y>=city.n)continue;
    const detail=Math.abs(dx)<=1&&Math.abs(dy)<=1?1:0;
    const affected=state.building&&x===state.building.bx&&y===state.building.by;
    const key=x+','+y+':'+detail+':'+(affected?cutKey:'');used.add(key);
    let mesh=this.cache.get(key);
    if(!mesh){const block=city.block(x,y);mesh=this.upload(geo.buildBlock(city,block,detail,affected?cut:{}));this.cache.set(key,mesh);}
    else{this.cache.delete(key);this.cache.set(key,mesh);}
    this.mesh(mesh);this.stats.blocks++;this.stats.detailedBlocks+=detail;
   }
   if(state.plan&&!state.exterior){
    const key=state.building.id+':'+state.plan.index+':'+state.mode+':'+state.fullHeight;
    if(this.floorMesh?.key!==key){if(this.floorMesh&&gl)gl.deleteBuffer(this.floorMesh.buffer);
     const entries=state.plan.roof?state.layer.buildings.map(b=>[b,city.floor(b,b.floors)]):[[state.building,state.plan]],parts=entries.map(([b,p])=>geo.buildFloor(city,b,p,state.plan.roof?state.layer.links:[],{eye:state.mode==='eye'||state.fullHeight}));
     const n=parts.reduce((s,p)=>s+p.vertices.length,0),vertices=new Float32Array(n),subjects=new Uint8Array(n/7);let at=0;for(const p of parts){vertices.set(p.vertices,at);if(p.subjects)subjects.set(p.subjects,at/7);at+=p.vertices.length;}
     this.floorMesh={...this.upload({vertices,subjects}),key};
    }
    this.mesh(this.floorMesh);
   }
   if(state.exterior&&geo.buildLift)this.dynamicMesh(geo.buildLift(state.building,body.z));
   if(!state.plan&&!state.exterior)for(const p of state.npcs||[])this.dynamicMesh(geo.buildActor(p,p.facing,state.time));
   if(state.mode!=='eye'&&geo.buildActor)this.dynamicMesh(geo.buildActor(body,state.facing,state.time));
   if(state.goal&&geo.buildMarker)this.dynamicMesh(geo.buildMarker(state.goal.x,state.goal.y,state.goal.z));
   while(this.cache.size>this.maxCache){const k=this.cache.keys().next().value,m=this.cache.get(k);if(gl)gl.deleteBuffer(m.buffer);this.cache.delete(k);}
   if(!gl){this.surface.present(this.ctx);this.stats.raster=this.surface.stats;}
   this.stats.cache=this.cache.size;return this.canvas;
  }
 }
 root.MeridianLegacyPerspective={Renderer};
})(window);
