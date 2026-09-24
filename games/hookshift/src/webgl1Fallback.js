export class WebGL1Fallback {
  constructor(container) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Hookshift Iron Canopy WebGL1 compatibility renderer');
    container.appendChild(this.canvas);
    const gl = this.canvas.getContext('webgl', { antialias: true, alpha: false }) || this.canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL1 unavailable');
    this.gl = gl;
    const vs = `
      attribute vec2 aPos;
      attribute vec3 aColor;
      varying vec3 vColor;
      void main(){ vColor=aColor; gl_Position=vec4(aPos,0.0,1.0); }
    `;
    const fs = `
      precision mediump float;
      varying vec3 vColor;
      void main(){ gl_FragColor=vec4(vColor,1.0); }
    `;
    const program = this._program(vs, fs);
    this.program = program;
    this.posLoc = gl.getAttribLocation(program, 'aPos');
    this.colorLoc = gl.getAttribLocation(program, 'aColor');
    this.buffer = gl.createBuffer();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.posLoc);
    gl.enableVertexAttribArray(this.colorLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(this.colorLoc, 3, gl.FLOAT, false, 20, 8);
    gl.disable(gl.DEPTH_TEST);
    this.setSize();
  }

  _shader(type, source) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  _program(vs, fs) {
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, this._shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this._shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  setSize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.floor(innerWidth * dpr));
    const h = Math.max(1, Math.floor(innerHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  render(s) {
    this.setSize();
    const gl = this.gl;
    gl.clearColor(0.055, 0.12, 0.085, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const verts = [];
    const aspect = this.canvas.width / this.canvas.height;
    const viewH = s.camera.worldH;
    const viewW = viewH * aspect;
    const sx = 2 / viewW, sy = 2 / viewH;
    const tx = -s.camera.x * sx, ty = -s.camera.y * sy;
    const push = (x, y, c) => verts.push(x * sx + tx, y * sy + ty, c[0], c[1], c[2]);
    const tri = (a,b,c,col) => { push(a[0],a[1],col); push(b[0],b[1],col); push(c[0],c[1],col); };
    const rect = (x,y,w,h,col) => {
      const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2;
      tri([l,b],[r,b],[r,t],col); tri([l,b],[r,t],[l,t],col);
    };
    const diamond = (x,y,r,col) => {
      tri([x,y+r],[x+r,y],[x,y-r],col); tri([x,y+r],[x,y-r],[x-r,y],col);
    };
    const rope = (x1,y1,x2,y2,width,col) => {
      const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1, nx=-dy/len*width,ny=dx/len*width;
      tri([x1+nx,y1+ny],[x2+nx,y2+ny],[x2-nx,y2-ny],col);
      tri([x1+nx,y1+ny],[x2-nx,y2-ny],[x1-nx,y1-ny],col);
    };

    // Distant canopy silhouettes.
    for (let i=0;i<14;i++) {
      const x = i*9-8;
      rect(x, 2.1, 6.5, 4.2, [0.08,0.23,0.13]);
      diamond(x, 5.6, 3.0, [0.09,0.3,0.15]);
    }
    for (const p of s.platforms) {
      const col = p.kind === 'metal' ? [0.28,0.34,0.29] : p.kind === 'hazard' ? [0.43,0.28,0.11] : [0.24,0.31,0.22];
      rect(p.x,p.y,p.w,p.h,col);
    }
    for (const a of s.anchors) {
      diamond(a.x,a.y,0.28,a.active?[0.35,1,0.78]:[0.9,0.74,0.25]);
      diamond(a.x,a.y,0.12,[0.08,0.12,0.09]);
    }
    if (s.rope) rope(s.player.x,s.player.y+0.6,s.rope.x,s.rope.y,0.055,[0.32,0.95,0.79]);
    for (const p of s.pickups) if (!p.taken) diamond(p.x,p.y,0.22,p.kind==='med'?[0.3,1,0.45]:[0.95,0.76,0.22]);
    for (const e of s.enemies) if (!e.dead) {
      rect(e.x,e.y+0.5,0.7,1.0,e.kind==='turret'?[0.58,0.22,0.15]:[0.62,0.52,0.28]);
      rect(e.x,e.y+1.15,0.44,0.35,[0.18,0.2,0.15]);
    }
    for (const b of s.bullets) rect(b.x,b.y,0.24,0.09,b.enemy?[1,0.35,0.2]:[1,0.87,0.25]);
    rect(s.player.x,s.player.y+0.55,0.72,1.1,s.player.invuln?[0.9,0.9,0.95]:[0.22,0.65,0.43]);
    rect(s.player.x,s.player.y+1.25,0.48,0.38,[0.83,0.72,0.54]);
    rect(s.spire.x,s.spire.y+5,1.1,10,[0.25,0.31,0.3]);
    diamond(s.spire.x,s.spire.y+10.2,0.65,s.complete?[0.2,0.95,0.45]:[1,0.22,0.15]);

    const data = new Float32Array(verts);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(this.colorLoc, 3, gl.FLOAT, false, 20, 8);
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 5);
  }
}
