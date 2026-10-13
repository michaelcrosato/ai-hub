(function (root) {
    'use strict';
    const E = root.My3D2dge, D = root.HARBOR_DATA, P = E.px;
    class HarborWorld {
        constructor(game) { this.game = game; this.buildings = D.buildings; this.cache = new Map(); this.floor = null; this.npcs = D.npcs.map(n => ({ ...n, home: [n.x, n.y], routeSource: n.route, motionTime: 0, vx: 0, vy: 0, facing: 1.2, routeStep: 1, route: null, schedule: 'home', rig: new E.HarborRig({ size: n.size, hair: n.hairStyle || 'short', colors: { skin: '#d6b299', hair: n.hair, cloth: n.color, pants: n.pants, boot: '#23353b', belt: '#46544a' } }) })); this.crates = D.crates.map(c => ({ ...c, delivered: false })); this.propCollision = [{ x: 576, y: 276, w: 33, d: 10 }, { x: 521, y: 283, w: 16, d: 15 }, { x: 127, y: 358, w: 23, d: 20 }, { x: 167, y: 360, w: 14, d: 14 }]; this.colliders = [...this.buildings, ...this.propCollision]; this.props = D.props; this.catPhase = 0; }
        reset() { for (const n of this.npcs) {
            n.x = n.home[0];
            n.y = n.home[1];
            n.schedule = 'home';
            n.route = null;
            n.routeStep = 1;
        } this.crates = D.crates.map(c => ({ ...c, delivered: false })); }
        npc(id) { return this.npcs.find(n => n.id === id); }
        canWalk(x, y, r = 7) {
            const b = D.bounds;
            if (!Number.isFinite(x) || !Number.isFinite(y) || x < b.minX + r || x > b.maxX - r || y < b.minY + r || y > b.maxY - r) return false;
            for (const o of this.colliders) {
                if (x < o.x-r || x > o.x+o.w+r || y < o.y-r || y > o.y+o.d+r) continue;
                if (Math.hypot(x-E.clamp(x,o.x,o.x+o.w), y-E.clamp(y,o.y,o.y+o.d)) < r) return false;
            }
            return true;
        }
        move(p, dx, dy, r = 7) { const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4)); for (let i = 0; i < n; i++) {
            if (this.canWalk(p.x + dx / n, p.y, r))
                p.x += dx / n;
            if (this.canWalk(p.x, p.y + dy / n, r))
                p.y += dy / n;
        } }
        path(start, end) {
            const B=D.bounds,s=14,ox=B.minX+9,oy=B.minY+9,W=Math.floor((B.maxX-ox-8)/s)+1,H=Math.floor((B.maxY-oy-8)/s)+1;
            const point=id=>({x:ox+(id%W)*s,y:oy+Math.floor(id/W)*s});
            const segment=(a,b)=>{const steps=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/5);for(let k=1;k<=steps;k++)if(!this.canWalk(E.lerp(a.x,b.x,k/steps),E.lerp(a.y,b.y,k/steps),8))return false;return true;};
            if(!this.navGrid) { this.navGrid=new Uint8Array(W*H); for(let id=0;id<W*H;id++){const p=point(id);this.navGrid[id]=this.canWalk(p.x,p.y,8)?1:0;} }
            const nearest=(p,requireLine=true)=>{const cx=Math.round((p.x-ox)/s),cy=Math.round((p.y-oy)/s);let best=-1,dist=Infinity;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=cx+dx,y=cy+dy,id=y*W+x;if(x<0||x>=W||y<0||y>=H||!this.navGrid[id])continue;const q=point(id),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<dist&&(!requireLine||segment(p,q))){best=id;dist=d;}}return best;};
            const sid=nearest(start),tid=nearest(end,false);if(sid<0||tid<0)return [];
            const costs=new Float64Array(W*H);costs.fill(Infinity);costs[sid]=0;const came=new Int32Array(W*H);came.fill(-1);const closed=new Uint8Array(W*H),heap=[];
            const score=id=>costs[id]+Math.hypot(id%W-tid%W,Math.floor(id/W)-Math.floor(tid/W));
            const push=(id,f)=>{heap.push({id,f});let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={id,f};};
            const pop=()=>{const head=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return head.id;};
            push(sid,score(sid));while(heap.length){const id=pop();if(closed[id])continue;if(id===tid){const out=[];let k=id;while(k!==-1){out.push(point(k));if(k===sid)break;k=came[k];}out.reverse();if(segment(out[out.length-1],end))out.push({x:end.x,y:end.y});return out;}
                closed[id]=1;const x=id%W,y=Math.floor(id/W);
                for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const nx=x+dx,ny=y+dy,k=ny*W+nx;if(nx<0||nx>=W||ny<0||ny>=H||closed[k]||!this.navGrid[k]||(dx&&dy&&(!this.navGrid[y*W+nx]||!this.navGrid[ny*W+x])))continue;const g=costs[id]+Math.hypot(dx,dy);if(g<costs[k]){costs[k]=g;came[k]=id;push(k,score(k));}}
            }return [];
        }
        update(dt, clock, player, mode) {
            for (const n of this.npcs) {
                let dest = 'home', route = null;
                if (n.id === 'emi' && clock.minutes >= 1050) {
                    dest = 'slipway';
                    route = [[n.home[0], n.home[1]], [550, 130], [550, 342], [756, 390]];
                }
                if (n.id === 'yui' && clock.minutes >= 1080) {
                    dest = 'waterfront';
                    route = [[n.home[0], n.home[1]], [410, 322], [413, 533]];
                }
                if (n.id === 'hana' && clock.minutes >= 1120) {
                    dest = 'closing';
                    route = [[n.home[0], n.home[1]], [279, 310]];
                }
                if (dest !== n.schedule && !n.ambient) {
                    n.schedule = dest;
                    n.route = route;
                    n.routeStep = 1;
                }
                if (n.ambient && !n.route) {
                    n.route = n.routeSource;
                    n.routeStep = 1;
                }
                n.vx = n.vy = 0;
                const paused = mode !== 'explore' && mode !== 'work';
                const close = Math.hypot(n.x-player.x,n.y-player.y)<280;
                n.motionTime += paused ? 0 : dt;
                const moveDt = !n.ambient || close || n.motionTime >= .1 ? Math.min(.1,n.motionTime) : 0;
                if(moveDt) n.motionTime=0;
                if (n.route && !paused && moveDt && Math.hypot(n.x - player.x, n.y - player.y) > 23) {
                    const t = n.route[n.routeStep];
                    if (t) {
                        const dx = t[0] - n.x, dy = t[1] - n.y, len = Math.hypot(dx, dy), sp = n.ambient ? 12 : 24;
                        if (len < 2) {
                            n.routeStep++;
                            if (n.routeStep >= n.route.length) {
                                if (n.ambient)
                                    n.routeStep = 0;
                                else
                                    n.route = null;
                            }
                        }
                        else {
                            n.vx = dx / len * sp;
                            n.vy = dy / len * sp;
                            this.move(n, n.vx * moveDt, n.vy * moveDt, 5);
                            n.facing = E.lerpAng(n.facing, Math.atan2(dy, dx), Math.min(1, dt * 8));
                        }
                    }
                }
                if (Math.hypot(n.x - player.x, n.y - player.y) < 30 && mode === 'dialogue')
                    n.facing = Math.atan2(player.y - n.y, player.x - n.x);
                if (!n.ambient || close) n.rig.update(dt, { ...n, pose: n.vx || n.vy ? null : n.pose || null });
            }
            this.catPhase += dt;
        }
        syncSchedules(clock) { if (clock.minutes >= 1050) {
            const n = this.npc('emi');
            Object.assign(n, { x: 756, y: 390, route: null, schedule: 'slipway' });
        } if (clock.minutes >= 1080) {
            const n = this.npc('yui');
            Object.assign(n, { x: 413, y: 533, route: null, schedule: 'waterfront' });
        } if (clock.minutes >= 1120) {
            const n = this.npc('hana');
            Object.assign(n, { x: 279, y: 310, route: null, schedule: 'closing' });
        } }
        poly(r, g, pts, c) { P.poly(g, pts.map(p => r.w(...p)), c); }
        line(r, g, a, b, c, w = 1) { const p = r.w(...a), q = r.w(...b); P.line(g, ...p, ...q, c, w); }
        box(r, g, x, y, z, w, d, h, c, side) { r.box(g, x, y, z, x + w, y + d, z + h, c, side || E.shade(c, -.12)); }
        buildFloor(view) {
            const B=D.bounds;
            const corners = [[B.minX-40,B.minY-40],[B.maxX+40,B.minY-40],[B.minX-40,B.maxY+40],[B.maxX+40,B.maxY+40]].map(p=>view.p(...p));
            const x0 = Math.floor(Math.min(...corners.map(p => p[0])) - 35), y0 = Math.floor(Math.min(...corners.map(p => p[1])) - 40);
            const x1 = Math.ceil(Math.max(...corners.map(p => p[0])) + 35), y1 = Math.ceil(Math.max(...corners.map(p => p[1])) + 40);
            const c = document.createElement('canvas');
            c.width = x1 - x0;
            c.height = y1 - y0;
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = false;
            const r = { view, w: (x, y, z = 0) => { const p = view.p(x, y, z); return [p[0] - x0, p[1] - y0]; }, box: E.Renderer.prototype.box };
            this.poly(r, g, [[B.minX-5, B.minY-5, -4], [813, B.minY-5, -4], [813, 600, -4], [B.minX-5, 600, -4]], '#2e494c');
            for (let y = B.minY-4; y < 598; y += 16)
                for (let x = B.minX-4; x < 810; x += 16) {
                    let color;
                    const h = E.hash2(x, y);
                    const road = (x>=30 && y>=20 && ((y>=310&&y<395)||(x>=550&&x<580)||(x>=400&&x<427)||(y>=112&&y<155))) || D.roads.some(a=>x>=a.x&&x<a.x+a.w&&y>=a.y&&y<a.y+a.d);
                    const dock = (x > 582 && y > 394);
                    if (road)
                        color = ['#4c6261', '#4d6262', '#506565', '#475e60'][Math.floor(h * 4)];
                    else if (dock)
                        color = ['#777863', '#727660', '#68715f', '#777c68'][Math.floor(h * 4)];
                    else
                        color = E.shade((D.districts.find(a=>x>=a.x&&x<a.x+a.w&&y>=a.y&&y<a.y+a.d)||D.districts[0]).color,(h-.5)*.09);
                    this.poly(r, g, [[x, y, 0], [x + 16, y, 0], [x + 16, y + 16, 0], [x, y + 16, 0]], color);
                    if (road) {
                        this.line(r, g, [x, y, 0], [x + 16, y, 0], '#3f585b');
                        if (h > .68)
                            this.line(r, g, [x + 4, y + 6, 0], [x + 11, y + 8, 0], '#607473');
                    }
                    else if (dock) {
                        this.line(r, g, [x, y, 0], [x + 16, y, 0], '#505e57');
                    }
                    else {
                        this.line(r, g, [x, y, 0], [x + 16, y, 0], '#52665f');
                        this.line(r, g, [x, y, 0], [x, y + 16, 0], '#52665f');
                    }
                    if (h > .8) {
                        const [px, py] = r.w(x + 6, y + 6);
                        P.rect(g, px, py, 2, 1, E.shade(color, .16));
                    }
                }
            for(const road of D.roads){
                const {x,y,w,d}=road; this.line(r,g,[x,y,1],[x+w,y,1],'#929782'); this.line(r,g,[x,y+d,1],[x+w,y+d,1],'#929782');
                if(w>100)for(let xx=x+14;xx<x+w;xx+=62)this.line(r,g,[xx,y+d/2,.4],[Math.min(xx+22,x+w),y+d/2,.4],'#acaa8e',2);
            }
            // Curbs, drains, road paint, and pools of reflected sky.
            for (const y of [305, 397]) {
                this.line(r, g, [42, y, 1], [805, y, 1], '#a5a48b', 2);
                this.line(r, g, [42, y + 4, 1], [805, y + 4, 1], '#314f52');
            }
            for (let x = 50; x < 800; x += 55)
                this.poly(r, g, [[x, 352, .2], [x + 25, 352, .2], [x + 25, 354, .2], [x, 354, .2]], '#b4b095');
            for (let y = 310; y < 395; y += 12)
                this.poly(r, g, [[400, y, .2], [425, y, .2], [425, y + 5, .2], [400, y + 5, .2]], '#a6aa93');
            for (let i = 0; i < 18; i++) {
                const x = 80 + E.hash2(i, 21) * 690, y = 310 + E.hash2(i, 9) * 82, w = 8 + E.hash2(i, 51) * 32;
                this.poly(r, g, [[x, y, .1], [x + w, y - 2, .1], [x + w + 4, y + 8, .1], [x + 5, y + 11, .1]], i % 3 === 0 ? '#729392' : '#587b7d');
                this.line(r, g, [x + 5, y + 3, .2], [x + w - 1, y + 3, .2], '#819e97');
            }
            for (const b of this.buildings) {
                this.poly(r, g, [[b.x + 4, b.y + b.d, 0], [b.x + b.w, b.y + b.d, 0], [b.x + b.w + 27, b.y + b.d + 27, 0], [b.x + 29, b.y + b.d + 27, 0]], '#3f5555');
            }
            this.poly(r, g, [[725, 496, .3], [777, 496, .3], [777, 554, .3], [725, 554, .3]], '#7e8568');
            for (let i = 0; i < 4; i++) {
                const a = [[725, 496], [777, 496], [777, 554], [725, 554]][i], b = [[725, 496], [777, 496], [777, 554], [725, 554]][(i + 1) % 4];
                this.line(r, g, [...a, 1], [...b, 1], '#d8be7f', 2);
            }
            // Harbor edge: inset stone caps and visible retaining wall.
            this.box(r, g, B.minX-5, 590, -18, 813-B.minX+5, 12, 20, '#828b7d', '#405e60');
            this.box(r, g, 804, B.minY-5, -18, 11, 600-B.minY+5, 20, '#828b7d', '#405e60');
            for (let x = B.minX; x < 810; x += 28)
                this.line(r, g, [x, 592, 3], [x, 601, 3], '#485f5b');
            for (let y = B.minY; y < 600; y += 28)
                this.line(r, g, [805, y, 3], [815, y, 3], '#485f5b');
            this.box(r,g,B.minX-7,B.minY-5,-18,12,1327,20,'#828b7d','#405e60');
            this.box(r,g,B.minX-5,B.minY-7,-18,1320,12,20,'#828b7d','#405e60');
            this.floor = { c, x0, y0 };
        }
        drawBuilding(r, g, b) {
            const x = b.x, y = b.y, w = b.w, d = b.d, h = b.h;
            this.box(r, g, x, y, 0, w, d, h, b.color, E.shade(b.color, -.08));
            // Weathered front plaster, side mortar, and a dark plinth.
            this.poly(r, g, [[x, y + d, .5], [x + w, y + d, .5], [x + w, y + d, 7], [x, y + d, 7]], '#344c4c');
            for (let z = 10; z < h - 6; z += 9) {
                this.line(r, g, [x + w + .15, y, z], [x + w + .15, y + d, z], E.shade(b.color, -.28));
                for (let yy = y + ((z % 18) ? 7 : 0); yy < y + d; yy += 19)
                    this.line(r, g, [x + w + .2, yy, z], [x + w + .2, yy, z + 9], E.shade(b.color, -.22));
            }
            const fy = y + d + .3;
            for (let xx = x + 7; xx < x + w - 8; xx += 23) {
                const ww = Math.min(20, x + w - 5 - xx), door = xx > x + w * .38 && xx < x + w * .66;
                this.poly(r, g, [[xx, fy, 9], [xx + ww, fy, 9], [xx + ww, fy, 39], [xx, fy, 39]], door ? '#243e43' : '#355c5d');
                this.poly(r, g, [[xx + 2, fy + .1, 12], [xx + ww - 2, fy + .1, 12], [xx + ww - 2, fy + .1, 36], [xx + 2, fy + .1, 36]], b.type === 'tea' || b.type === 'books' ? '#aa9c6a' : '#647f76');
                this.line(r, g, [xx + ww / 2, fy + .3, 12], [xx + ww / 2, fy + .3, 38], '#314c4d', 2);
                this.line(r, g, [xx + 1, fy + .3, 24], [xx + ww - 1, fy + .3, 24], '#354d4b');
                if (door)
                    this.line(r, g, [xx + ww - 4, fy + .7, 19], [xx + ww - 4, fy + .7, 25], '#c9b88c', 2);
                else {
                    for (let k = 0; k < 3; k++)
                        this.line(r, g, [xx + 3 + k * 4, fy + .5, 12], [xx + 3 + k * 4, fy + .5, 18 + k * 3], ['#a35440', '#b6b68b', '#688b83'][k], 2);
                }
            }
            if (h > 70)
                for (let xx = x + 9; xx < x + w - 18; xx += 29) {
                    this.poly(r, g, [[xx, fy, 58], [xx + 20, fy, 58], [xx + 20, fy, h - 5], [xx, fy, h - 5]], '#314c54');
                    this.poly(r, g, [[xx + 2, fy + .2, 60], [xx + 18, fy + .2, 60], [xx + 18, fy + .2, h - 7], [xx + 2, fy + .2, h - 7]], '#a9b5a0');
                    this.line(r, g, [xx + 10, fy + .4, 60], [xx + 10, fy + .4, h - 7], '#4e615d', 2);
                }
            // Flat sign boards stay pixel-crisp and readable from this camera.
            const [sx, sy] = r.w(x + w * .5, fy + 1, 49);
            const label = b.name;
            const sw = label.length * 5 + 9;
            P.rect(g, sx - sw / 2 - 1, sy - 2, sw + 2, 15, '#263f45');
            P.rect(g, sx - sw / 2, sy - 1, sw, 12, b.trim);
            E.font.text(g, label, sx, sy + 2, b.type === 'tea' || b.type === 'arcade' ? '#f4dfb8' : '#203d43', { align: 'center', shadow: false, outline: false });
            // Corrugated roof, metal ridge, and gutters.
            const ridge = h + 8;
            this.poly(r, g, [[x - 4, y - 3, h], [x + w + 4, y - 3, h], [x + w + 4, y + d * .4, ridge], [x - 4, y + d * .4, ridge]], E.shade(b.roof, .12));
            this.poly(r, g, [[x - 4, y + d * .4, ridge], [x + w + 4, y + d * .4, ridge], [x + w + 4, y + d + 5, h], [x - 4, y + d + 5, h]], b.roof);
            for (let xx = x - 3; xx < x + w + 4; xx += 5) {
                this.line(r, g, [xx, y - 2, h + .1], [xx, y + d * .4, ridge + .1], E.shade(b.roof, .23));
                this.line(r, g, [xx, y + d * .4, ridge + .1], [xx, y + d + 4, h + .1], E.shade(b.roof, .15));
            }
            this.line(r, g, [x - 5, y + d + 5, h], [x + w + 5, y + d + 5, h], '#9ba69a', 2);
            this.line(r, g, [x + w + 1, y + d, 4], [x + w + 1, y + d, h], '#485e5c', 2);
            if (b.type === 'tea' || b.type === 'books' || b.type === 'arcade') {
                for (let xx = x - 2; xx < x + w; xx += 12) {
                    this.poly(r, g, [[xx, fy, 41], [Math.min(xx + 12, x + w + 2), fy, 41], [Math.min(xx + 12, x + w + 2), fy + 16, 34], [xx, fy + 16, 34]], Math.floor((xx - x) / 12) % 2 ? E.shade(b.trim, .2) : b.trim);
                    this.poly(r, g, [[xx, fy + 16, 34], [Math.min(xx + 12, x + w + 2), fy + 16, 34], [Math.min(xx + 12, x + w + 2), fy + 16, 30], [xx, fy + 16, 30]], E.shade(b.trim, -.18));
                }
                this.line(r, g, [x - 1, fy + 16, 0], [x - 1, fy + 16, 33], '#485b52', 2);
                this.line(r, g, [x + w + 1, fy + 16, 0], [x + w + 1, fy + 16, 33], '#485b52', 2);
            }
            // Roof equipment and small signs of use.
            this.box(r, g, x + w * .65, y + d * .22, h + 5, 18, 16, 10, '#7d8e87', '#5c736f');
            for (let k = 0; k < 4; k++)
                this.line(r, g, [x + w * .65 + 3, y + d * .22 + 16, h + 7 + k * 2], [x + w * .65 + 15, y + d * .22 + 16, h + 7 + k * 2], '#344e50');
            if (b.type !== 'warehouse') {
                this.line(r, g, [x + 18, y + 15, h + 5], [x + 18, y + 15, h + 30], '#91a096');
                this.line(r, g, [x + 8, y + 15, h + 25], [x + 31, y + 15, h + 25], '#91a096');
                for (let i = 0; i < 3; i++)
                    this.line(r, g, [x + 11 + i * 8, y + 10, h + 25], [x + 11 + i * 8, y + 20, h + 25], '#879c92');
            }
            if (b.type === 'garage' || b.type === 'warehouse') {
                for (let xx = x + 12; xx < x + w - 8; xx += 22)
                    this.poly(r, g, [[xx, fy + .5, 8], [xx + 18, fy + .5, 8], [xx + 18, fy + .5, 38], [xx, fy + .5, 38]], '#567178');
                for (let z = 9; z < 39; z += 4)
                    this.line(r, g, [x + 12, fy + 1, z], [x + w - 8, fy + 1, z], '#3b565e');
            }
        }
        buildingStamp(b, view) { const key = b.id + ':' + view.scale; let st = this.cache.get(key); if (st)
            return st; const pts = []; for (const x of [b.x - 15, b.x + b.w + 15])
            for (const y of [b.y - 15, b.y + b.d + 30])
                for (const z of [0, b.h + 40])
                    pts.push(view.p(x, y, z)); const x0 = Math.floor(Math.min(...pts.map(p => p[0]))) - 15, y0 = Math.floor(Math.min(...pts.map(p => p[1]))) - 10, x1 = Math.ceil(Math.max(...pts.map(p => p[0]))) + 15, y1 = Math.ceil(Math.max(...pts.map(p => p[1]))) + 10; const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; const r = { view, w: (x, y, z = 0) => { const p = view.p(x, y, z); return [p[0] - x0, p[1] - y0]; }, box: E.Renderer.prototype.box }; this.drawBuilding(r, g, b); st = { c, x0, y0 }; this.cache.set(key, st); return st; }
        crate(r, g, c, z = 0) { this.box(r, g, c.x - 9, c.y - 8, z, 18, 16, 15, '#a3946d', '#7f7c60'); this.line(r, g, [c.x - 7, c.y + 8, z + 2], [c.x + 7, c.y + 8, z + 13], '#d1bb85', 2); this.line(r, g, [c.x + 7, c.y + 8, z + 2], [c.x - 7, c.y + 8, z + 13], '#6a715a'); const [x, y] = r.w(c.x, c.y + 8, z + 10); P.rect(g, x - 4, y - 4, 8, 7, '#d2c498'); if (c.tag)
            E.font.text(g, c.tag, x, y - 3, '#485653', { align: 'center', font: 'tiny', shadow: false, outline: false }); }
        drawProp(r, g, o, t, state) {
            const x = o.x, y = o.y;
            switch (o.type) {
                case 'bench':
                    for (let z of [10, 22]) {
                        this.box(r, g, x - 25, y - 5, z, 50, 4, 3, '#b1a282', '#736f59');
                    }
                    for (const xx of [x - 21, x + 21]) {
                        this.box(r, g, xx, y - 5, 0, 3, 11, 12, '#405e5e');
                        this.box(r, g, xx, y - 6, 0, 3, 3, 27, '#405e5e');
                    }
                    this.box(r, g, x - 25, y - 4, 10, 50, 13, 3, '#a39574');
                    break;
                case 'lockers':
                    this.box(r, g, x - 19, y - 9, 0, 38, 13, 39, '#708781', '#3d6168');
                    for (let i = 0; i < 4; i++) {
                        const a = x - 17 + i * 9;
                        this.poly(r, g, [[a, y + 4.5, 3], [a + 8, y + 4.5, 3], [a + 8, y + 4.5, 36], [a, y + 4.5, 36]], i === 3 ? '#799483' : '#637f7d');
                        this.line(r, g, [a + 6, y + 5, 16], [a + 6, y + 5, 20], '#d0bf8e', 1);
                        const p = r.w(a + 4, y + 5, 30);
                        E.font.text(g, String(i + 1), p[0], p[1], '#ede0b7', { align: 'center', shadow: false, outline: false });
                    }
                    break;
                case 'vending':
                    this.box(r, g, x - 7, y - 7, 0, 14, 13, 37, '#a56754', '#8b4f43');
                    this.poly(r, g, [[x - 5, y + 6.6, 14], [x + 5, y + 6.6, 14], [x + 5, y + 6.6, 33], [x - 5, y + 6.6, 33]], '#aec4b0');
                    for (let k = 0; k < 6; k++) {
                        const p = r.w(x - 3 + (k % 3) * 3, y + 7, 28 - Math.floor(k / 3) * 8);
                        P.rect(g, p[0], p[1], 2, 4, ['#d8b873', '#647e9b', '#b96955'][k % 3]);
                    }
                    this.poly(r, g, [[x - 4, y + 7, 5], [x + 4, y + 7, 5], [x + 4, y + 7, 10], [x - 4, y + 7, 10]], '#304b50');
                    break;
                case 'arcade':
                    this.box(r, g, x - 8, y - 7, 0, 17, 15, 30, '#655d53', '#513e39');
                    this.poly(r, g, [[x - 6, y + 8, 14], [x + 6, y + 8, 14], [x + 6, y + 4, 29], [x - 6, y + 4, 29]], '#122f3a');
                    const ap = r.w(x, y + 8, 24);
                    P.rect(g, ap[0] - 4, ap[1] - 6, 9, 7, '#78b3a5');
                    this.line(r, g, [x - 8, y + 8, 11], [x + 8, y + 8, 11], '#b7634c', 3);
                    break;
                case 'capsule':
                    this.box(r, g, x - 5, y - 5, 0, 10, 10, 12, '#b66551', '#8b5149');
                    const cp = r.w(x, y, 20);
                    P.ell(g, cp[0], cp[1], 7, 10, '#afc3b0');
                    for (let i = 0; i < 4; i++)
                        P.disc(g, cp[0] - 3 + i * 2, cp[1] + (i % 2) * 3, 2, ['#cc9161', '#778e9c', '#9da87e', '#a57062'][i]);
                    this.box(r, g, x - 6, y - 6, 27, 12, 12, 3, '#ac7056');
                    break;
                case 'board':
                    this.box(r, g, x - 12, y, 19, 24, 3, 22, '#a59c7d', '#726f5a');
                    for (const xx of [x - 10, x + 10])
                        this.box(r, g, xx, y, 0, 2, 2, 21, '#53605b');
                    this.poly(r, g, [[x - 10, y + 3.2, 22], [x + 10, y + 3.2, 22], [x + 10, y + 3.2, 38], [x - 10, y + 3.2, 38]], '#c4b991');
                    for (let i = 0; i < 3; i++) {
                        const p = r.w(x - 7 + i * 6, y + 4, 34);
                        P.rect(g, p[0], p[1], 4, 6, i === 1 ? '#9ea794' : '#e1d3ad');
                    }
                    break;
                case 'cat': {
                    const q = r.w(x, y, 4);
                    P.ell(g, q[0], q[1], 9, 4, '#b4b2a0');
                    P.ell(g, q[0] + 6, q[1] - 4, 4, 4, '#d2cbb4');
                    P.poly(g, [[q[0] + 3, q[1] - 6], [q[0] + 4, q[1] - 11], [q[0] + 6, q[1] - 7]], '#aaa990');
                    P.poly(g, [[q[0] + 7, q[1] - 7], [q[0] + 10, q[1] - 10], [q[0] + 10, q[1] - 5]], '#aaa990');
                    P.line(g, q[0] - 7, q[1], q[0] - 13, q[1] - 4 - Math.sin(t) * 2, '#b4b2a0', 2);
                    P.dot(g, q[0] + 7, q[1] - 4, '#283f40');
                    if (state.case.flags.catFed) {
                        const p = r.w(x, y, 20);
                        E.font.text(g, '~', p[0], p[1] + Math.sin(t) * 2, '#dcba81', { align: 'center' });
                    }
                    break;
                }
                case 'flowers':
                    for (let i = 0; i < 6; i++) {
                        this.line(r, g, [x - 8 + i * 3, y + i % 2, 0], [x - 8 + i * 3, y + i % 2, 9 + i % 3], '#4c7560');
                        const p = r.w(x - 8 + i * 3, y + i % 2, 10 + i % 3);
                        P.disc(g, ...p, 2, i % 2 ? '#d6c095' : '#cb8d75');
                    }
                    break;
                case 'ferrybell':
                    this.box(r, g, x, y, 0, 3, 3, 40, '#738782');
                    const bp = r.w(x + 1, y + 1, 36);
                    P.disc(g, bp[0], bp[1], 5, '#bca575');
                    P.rect(g, bp[0] - 6, bp[1] + 2, 13, 2, '#d9c18a');
                    break;
                case 'radio':
                    this.box(r, g, x - 12, y - 4, 0, 24, 13, 16, '#6f7d70', '#425f5c');
                    this.box(r, g, x - 9, y - 3, 16, 18, 11, 13, '#a5a58c', '#6b7d70');
                    const rp = r.w(x, y + 9, 24);
                    P.rect(g, rp[0] - 8, rp[1] - 3, 11, 5, '#c9c797');
                    P.disc(g, rp[0] + 7, rp[1], 3, '#354f50');
                    this.line(r, g, [x + 6, y, 29], [x + 9, y, 49], '#a3b0a0');
                    break;
            }
        }
        draw(r, state) {
            const t = this.game.time, night = E.clamp((state.clock.minutes - 1040) / 170, 0, 1);
            P.rect(r.ctx, 0, 0, r.W, r.H, E.mix('#385e65', '#274859', night));
            if (!this.floor)
                this.buildFloor(r.view);
            const f = this.floor;
            r.ctx.drawImage(f.c, Math.round(f.x0 - r.ix), Math.round(f.y0 - r.iy));
            // Tidal water, foam, and reflected dock lights.
            for (let i = 0; i < 115; i++) {
                let x = 40 + E.hash2(i, 21) * 940, y = 612 + E.hash2(i, 45) * 360;
                if (i < 40) {
                    x = 830 + E.hash2(i, 81) * 190;
                    y = E.hash2(i, 93) * 600;
                }
                const w = 5 + E.hash2(i, 8) * 28, drift = Math.sin(t * .4 + i) * 4;
                this.line(r, r.ctx, [x + drift, y, -8], [x + w + drift, y, -8], i % 8 === 0 ? '#9aa892' : i % 3 === 0 ? '#668f8c' : '#476f78', 1);
            }
            // Boats remain tied to the seawall.
            for (const [x, y] of [[628, 649], [340, 668], [875, 367]]) {
                const z = Math.sin(t * .8 + x) * 1.2;
                r.queue(x, y, 0, g => { this.poly(r, g, [[x - 32, y - 13, z], [x + 33, y - 13, z], [x + 42, y, z], [x + 22, y + 17, z], [x - 29, y + 13, z]], '#253f4c'); this.poly(r, g, [[x - 29, y - 12, z + 7], [x + 28, y - 12, z + 7], [x + 36, y, z + 7], [x + 20, y + 12, z + 7], [x - 27, y + 10, z + 7]], '#a9b3a4'); this.box(r, g, x - 8, y - 9, z + 8, 24, 18, 17, '#8b9f91', '#708d87'); this.poly(r, g, [[x - 5, y + 9, z + 11], [x + 12, y + 9, z + 11], [x + 12, y + 9, z + 21], [x - 5, y + 9, z + 21]], '#254955'); this.box(r, g, x - 10, y - 11, z + 26, 28, 22, 3, '#ab6d50'); this.line(r, g, [x + 17, y + 2, z + 10], [x + 17, y + 2, z + 47], '#a7b5a3'); });
            }
            for (const b of this.buildings) {
                if(!r.visible(b.x+b.w/2,b.y+b.d/2,0,260,230,300))continue;
                const st = this.buildingStamp(b, r.view);
                const pp = r.view.p(state.player.x, state.player.y, 27);
                const overlaps = pp[0] > st.x0 + 18 && pp[0] < st.x0 + st.c.width - 18 && pp[1] > st.y0 + 10 && pp[1] < st.y0 + st.c.height - 8 && state.player.y < b.y + b.d && state.player.x < b.x + b.w + 8;
                const fade = overlaps ? .45 : 1;
                r.queue(b.x + b.w * .5, b.y + b.d, 0, g => { g.globalAlpha = fade; g.drawImage(st.c, Math.round(st.x0 - r.ix), Math.round(st.y0 - r.iy)); g.globalAlpha = 1; }, { occluder: true });
            }
            // Lamps, utility poles, and overhead cables.
            for (const [x, y] of [[168, 300], [312, 299], [415, 303], [548, 307], [598, 390], [760, 440], [452, 575], [85, 325]]) {
                r.queue(x, y, 0, g => { this.box(r, g, x - 1, y - 1, 0, 3, 3, 72, '#435d60'); this.line(r, g, [x, y, 72], [x + 10, y, 72], '#8d9d91', 2); const q = r.w(x + 10, y, 67); P.rect(g, q[0] - 4, q[1] - 3, 8, 9, '#d4a76b'); P.rect(g, q[0] - 3, q[1] - 1, 6, 5, '#f4d9a1'); P.line(g, q[0] - 5, q[1] - 4, q[0] + 4, q[1] - 4, '#3f5757', 2); });
                r.decal(g => { const p = r.w(x + 10, y + 12, 0); r.glowDisc(g, p[0], p[1], 28, '#d6aa68', .09 + .12 * night); });
            }
            for (const [a, b] of [[[168, 300, 75], [415, 303, 75]], [[415, 303, 75], [598, 390, 75]], [[548, 307, 75], [760, 440, 75]]])
                r.queue((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 80, g => { for (let i = 0; i < 18; i++) {
                    const u = i / 18, v = (i + 1) / 18, pt = k => [E.lerp(a[0], b[0], k), E.lerp(a[1], b[1], k), E.lerp(a[2], b[2], k) - Math.sin(k * Math.PI) * 7];
                    this.line(r, g, pt(u), pt(v), '#2c444c');
                } });
            // Tea lanterns and glowing windows are kept small and warm.
            for (const [x, y] of [[188, 298], [279, 298], [438, 284], [510, 284]])
                r.queue(x, y, 35, g => { const p = r.w(x, y, 39); P.ell(g, p[0], p[1], 5, 9, '#e2b578'); for (let yy = -6; yy <= 6; yy += 3)
                    P.line(g, p[0] - 4, p[1] + yy, p[0] + 4, p[1] + yy, '#b88553'); P.rect(g, p[0] - 3, p[1] - 10, 6, 2, '#344d4e'); P.rect(g, p[0] - 3, p[1] + 9, 6, 2, '#344d4e'); r.glowDisc(g, p[0], p[1], 23, '#e8b876', .12 + .1 * night); }, { emissive: true });
            this.drawDistrict(r,state,t,night);
            for (const o of this.props) {
                if(!r.visible(o.x,o.y,0,80,80,150))continue;
                r.shadow(o.x, o.y, o.type === 'bench' ? 17 : 6, .24);
                r.queue(o.x, o.y, 0, g => this.drawProp(r, g, o, t, state));
            }
            // Stacks, bins, potted shrubs, and dock bollards.
            for (const [x, y] of [[70, 294], [77, 280], [533, 132], [603, 395], [615, 393], [730, 132], [746, 137]])
                r.queue(x, y, 0, g => this.crate(r, g, { x, y }));
            for (let i = 0; i < 9; i++) {
                const x = 68 + i * 84, y = 582;
                r.queue(x, y, 0, g => { this.box(r, g, x, y, 0, 6, 6, 12, '#445d5f'); this.box(r, g, x - 2, y - 2, 10, 10, 10, 3, '#738c7c'); });
            }
            for (const [x, y] of [[175, 289], [305, 285], [400, 286], [431, 285], [360, 525], [79, 183]])
                r.queue(x, y, 0, g => { this.box(r, g, x - 5, y - 5, 0, 10, 10, 9, '#927a59'); const p = r.w(x, y, 17); P.disc(g, p[0], p[1], 9, '#4b735e'); P.disc(g, p[0] - 3, p[1] - 4, 6, '#63866d'); P.disc(g, p[0] + 5, p[1] + 1, 5, '#63866d'); });
            // Cargo task uses actual world objects.
            for (const c of this.crates) {
                if (state.carry === c.id)
                    continue;
                const q = c.delivered ? { x: 739 + (c.id % 2) * 23, y: 513 + Math.floor(c.id / 2) * 23, tag: c.tag } : c;
                r.shadow(q.x, q.y, 10, .3);
                r.queue(q.x, q.y, 0, g => this.crate(r, g, q));
                if (state.mode === 'work' && !c.delivered) {
                    r.groundRing(q.x, q.y, 15, '#e5c78d', .85);
                    r.textAt(q.x, q.y, 30, c.tag, '#ead5ac', { align: 'center' });
                }
            }
            if (state.mode === 'work')
                r.groundRing(750, 525, 31, '#dac080', .6 + .3 * Math.sin(t * 2));
            for (const n of this.npcs) {
                if(!r.visible(n.x,n.y,0,80,60,120))continue;
                if (state.training && n.id === 'imai')
                    continue;
                r.shadow(n.x, n.y, 6, .28);
                r.actor(n.x, n.y, 0, (g, ox, oy) => n.rig.draw(g, ox, oy, r.view), n.ambient ? {outline:false,rim:false} : { outlineColor: '#28414a', rim: true, rimColor: '#d9c799' });
                if (state.nearest && state.nearest.id === n.id && state.mode === 'explore') {
                    r.groundRing(n.x, n.y, 12, '#d9b884', .8);
                    r.textAt(n.x, n.y, 53, n.name.toUpperCase(), '#eddbb9', { align: 'center', shadow: '#122a33' });
                }
            }
            state.activities?.draw(r);
            const p = state.player;
            if (state.mode === 'chase') {
                const nx = p.x + 38, ny = p.y - 15;
                r.actor(nx, ny, 0, (g, ox, oy) => state.runnerRig.draw(g, ox, oy, r.view), { outlineColor: '#142c38' });
            }
            if (state.enemies)
                for (const en of state.enemies) {
                    r.shadow(en.x, en.y, 7, .35);
                    if (en.intent > 0 && !en.dead) {
                        r.groundRing(en.x, en.y, 23, '#f0ac74', .85);
                        r.groundArc(en.x, en.y, 22, 25, en.facing - .8, en.facing + .8, '#d69268', .55);
                    }
                    r.actor(en.x, en.y, 0, (g, ox, oy) => en.rig.draw(g, ox, oy, r.view), { outlineColor: '#1f3741', flash: en.hurt > 0 ? '#e7c7a0' : null });
                    if (!en.dead) {
                        const q = r.w(en.x, en.y, 56);
                        r.overlay(g => { P.rect(g, q[0] - 17, q[1], 34, 3, '#243e44'); P.rect(g, q[0] - 17, q[1], 34 * en.hp / en.maxHp, 3, '#cb9b79'); });
                    }
                }
            r.shadow(p.x, p.y, 7, .34);
            r.actor(p.x, p.y, p.z || 0, (g, ox, oy) => state.rig.draw(g, ox, oy, r.view), { outlineColor: '#17323d', rimColor: '#ffdeab', xray: { color: '#c1b786', outline: '#f5dfb1' }, flash: p.hurt > 0 ? '#f0cca3' : null });
            if (state.carry !== null && state.carry !== undefined) {
                const dx = Math.cos(p.facing) * 9, dy = Math.sin(p.facing) * 9;
                r.queue(p.x + dx, p.y + dy, 20, g => this.crate(r, g, { x: p.x + dx, y: p.y + dy, tag: String(state.carry + 1).padStart(2, '0') }, 20));
            }
            if (state.path && state.path.length) {
                const dest = state.path[state.path.length - 1];
                r.groundRing(dest.x, dest.y, 7, '#ded6af', .65);
            }
            if (night > 0)
                r.overlay(g => { g.globalAlpha = night * .13; P.rect(g, 0, 0, r.W, r.H, '#172d51'); g.globalAlpha = 1; });
            // Fine remaining rain and slow gulls bring movement into quiet scenes.
            if (!state.settings.reducedMotion)
                r.overlay(g => { for (let i = 0; i < 28; i++) {
                    const x = (E.hash2(i, 23) * r.W + t * 20) % r.W, y = (E.hash2(i, 67) * r.H + t * 100) % r.H;
                    P.line(g, x, y, x - 2, y + 5, '#a1b2ad40');
                } for (let i = 0; i < 3; i++) {
                    const x = ((t * 6 + i * 213) % (r.W + 80)) - 40, y = 50 + Math.sin(t * .3 + i) * 13 + i * 25, wing = Math.sin(t * 4 + i) * 3;
                    P.line(g, x - 4, y + wing, x, y, '#d4d5bd');
                    P.line(g, x, y, x + 4, y + wing, '#d4d5bd');
                } });
        }
        drawMap(canvas, state, large = false) {
            const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, pad = large ? 40 : 8, scale = Math.min((W - pad * 2) / 850, (H - pad * 2) / 630), ox = (W - 850 * scale) / 2, oy = (H - 630 * scale) / 2, xy = (x, y) => [ox + x * scale, oy + y * scale];
            g.clearRect(0, 0, W, H);
            g.fillStyle = '#102930';
            g.fillRect(0, 0, W, H);
            g.fillStyle = '#25464a';
            g.fillRect(ox + 30 * scale, oy + 10 * scale, 785 * scale, 590 * scale);
            g.strokeStyle = '#466760';
            g.lineWidth = large ? 2 : 1;
            for (const y of [310, 395, 590]) {
                g.beginPath();
                g.moveTo(...xy(30, y));
                g.lineTo(...xy(810, y));
                g.stroke();
            }
            for (const b of this.buildings) {
                g.fillStyle = '#5c7268';
                g.fillRect(ox + b.x * scale, oy + b.y * scale, b.w * scale, b.d * scale);
                g.strokeStyle = '#8d9b83';
                g.strokeRect(ox + b.x * scale, oy + b.y * scale, b.w * scale, b.d * scale);
            }
            if (large) {
                g.font = '12px Arial';
                g.fillStyle = '#b5c6ad';
                g.textAlign = 'center';
                g.fillText('N', W / 2, 20);
                g.font = '12px Arial';
                for (const m of D.landmarks) {
                    const [x, y] = xy(m.x, m.y);
                    g.fillStyle = '#ded4b4';
                    g.fillText(m.name, x, y + 13);
                }
            }
            for (const n of this.npcs.filter(n => !n.ambient)) {
                const [x, y] = xy(n.x, n.y);
                g.fillStyle = '#8aafa4';
                g.beginPath();
                g.arc(x, y, large ? 3 : 1.8, 0, Math.PI * 2);
                g.fill();
            }
            const objective = D.objectives[state.case.stage], target = state.targetFor ? state.targetFor(objective.target) : null;
            if (target) {
                const [x, y] = xy(target.x, target.y);
                g.strokeStyle = '#e4b477';
                g.lineWidth = 1;
                g.beginPath();
                g.arc(x, y, large ? 10 : 5, 0, Math.PI * 2);
                g.stroke();
                g.fillStyle = '#e4b477';
                g.beginPath();
                g.arc(x, y, large ? 3 : 2, 0, Math.PI * 2);
                g.fill();
            }
            const p = state.player, [x, y] = xy(p.x, p.y);
            g.save();
            g.translate(x, y);
            g.rotate(p.facing + Math.PI / 2);
            g.fillStyle = '#f7ead0';
            g.beginPath();
            g.moveTo(0, -(large ? 7 : 4));
            g.lineTo(large ? 5 : 3, large ? 5 : 3);
            g.lineTo(0, large ? 3 : 1);
            g.lineTo(large ? -5 : -3, large ? 5 : 3);
            g.closePath();
            g.fill();
            g.restore();
        }
    }
    root.HarborWorld = HarborWorld;
})(window);
