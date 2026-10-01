// The Brickyard on three.js r186 (kit.renderer: WebGPU, WebGL2 fallback).
//
// It keeps the look of the original software renderer: an orthographic broadcast camera,
// unlit bricks whose top / side / end faces carry fixed brightness (1.12 / 0.84 / 0.98),
// painted turf decals, soft contact shadows, a yellow control ring and dashed routes.
// Draw calls: one baked stadium mesh, one baked crowd mesh (it hops when the crowd cheers),
// one kit.instanced batch for every moving brick, plus decals, shadows, jersey numbers,
// the ring and the routes, each a single draw.
import * as THREE from 'three/webgpu';
import { abs, attribute, instancedBufferAttribute, positionLocal, sin, texture, time, uniform, uv, vec2, vec3 } from 'three/tsl';
import { bakeInstances } from 'kit/instancing.js';
import { buildStadium, writeDynamic } from './stadium.js';
import { CameraRig } from './camera.js';

// The original painted sRGB colours straight onto a 2D canvas. Keeping three's colour
// management out of the way makes every brick and decal come out exactly as authored.
THREE.ColorManagement.enabled = false;

/** Face brightness of the software renderer, in BoxGeometry face order: +x −x +y −y +z −z. */
const FACE = [0.84, 0.84, 1.12, 0.7, 0.98, 0.98];
const DYNAMIC_CAP = 1400;
const SHADOW_CAP = 24;
const NUMBER_CAP = 48;
const DASH_CAP = 480;
const ROUTE_Y = 0.3;

const colorCache = new Map();
const scratch = new THREE.Color();
/** '#rrggbb' → [r, g, b] (cached; no allocation in the frame loop). */
function rgb(hex) {
    let c = colorCache.get(hex);
    if (!c) {
        scratch.set(hex);
        c = [scratch.r, scratch.g, scratch.b];
        colorCache.set(hex, c);
    }
    return c;
}

/** A unit box whose vertex colours carry the per-face shading. */
function shadedBox() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.deleteAttribute('uv');
    geo.clearGroups();
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let v = 0; v < n; v++)
        col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = FACE[Math.floor(v / 4)];
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
}

/** Write a translation + scale (+ optional half-turn about Y) into a matrix array. */
function writeTRS(e, o, x, y, z, sx, sy, sz, flip = false) {
    const f = flip ? -1 : 1;
    e[o] = sx * f; e[o + 1] = 0; e[o + 2] = 0; e[o + 3] = 0;
    e[o + 4] = 0; e[o + 5] = sy; e[o + 6] = 0; e[o + 7] = 0;
    e[o + 8] = 0; e[o + 9] = 0; e[o + 10] = sz * f; e[o + 11] = 0;
    e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
}

function flagUpload(attr, count) {
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, Math.max(1, count) * attr.itemSize);
    attr.needsUpdate = true;
}

export class StadiumRenderer {
    constructor(kit) {
        this.kit = kit;
        const r = kit.renderer;
        r.outputColorSpace = THREE.LinearSRGBColorSpace;
        // The sky, sun and vignette are CSS behind and over the canvas (exactly the original gradients).
        r.setClearColor(0x000000, 0);
        this.kind = kit.backend === 'webgpu' ? 'WEBGPU' : 'WEBGL2';
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-80, 80, 60, -60, 1, 1200);
        this.rig = new CameraRig();
        this.w = 1;
        this.h = 1;
        kit.onResize((w, h) => {
            this.w = w;
            this.h = h;
        });
        this.box = shadedBox();
        this.cheerLevel = 0;
        this.routeKey = -1;
        this.routeDashes = 0;
        this.buildStadium();
        this.buildDynamic();
        this.buildMarkers();
        this.buildNumbers();
    }

    // ---- static: the stadium and its crowd, baked into two meshes
    bake(list, material) {
        const batch = new THREE.InstancedMesh(this.box, material, list.length);
        const m = new THREE.Matrix4();
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            m.makeScale(b.w, b.h, b.d);
            m.setPosition(b.x, b.y, b.z);
            batch.setMatrixAt(i, m);
            const c = rgb(b.color);
            batch.setColorAt(i, scratch.setRGB(c[0], c[1], c[2]));
        }
        return bakeInstances(batch);
    }

    buildStadium() {
        const { boxes, decals } = buildStadium();
        const plain = boxes.filter(b => b.fan < 0), crowd = boxes.filter(b => b.fan >= 0);
        this.scene.add(this.bake(plain, new THREE.MeshBasicMaterial({ vertexColors: true })));
        // The crowd: one mesh; each seat (body + head) hops with the cheer uniform, out of phase.
        this.cheer = uniform(0);
        const crowdMat = new THREE.MeshBasicNodeMaterial({ vertexColors: true });
        const seat = attribute('seat', 'float');
        crowdMat.positionNode = positionLocal.add(vec3(0, abs(sin(time.mul(10.5).add(seat.mul(2.399)))).mul(this.cheer).mul(0.8), 0));
        const crowdMesh = this.bake(crowd, crowdMat);
        const verts = this.box.attributes.position.count;
        const seats = new Float32Array(crowd.length * verts);
        for (let i = 0; i < crowd.length; i++)
            seats.fill(crowd[i].fan, i * verts, (i + 1) * verts);
        crowdMesh.geometry.setAttribute('seat', new THREE.BufferAttribute(seats, 1));
        this.scene.add(crowdMesh);
        this.scene.add(this.buildDecals(decals));
    }

    /** Every painted word and number in one atlas and one merged mesh. */
    buildDecals(decals) {
        const E = 96; // atlas pixels per world unit of decal size (the decal's em)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const font = `900 ${E}px Impact, 'Arial Narrow', 'Arial Black', sans-serif`;
        ctx.font = font;
        const W = 2048, rowH = Math.ceil(E * 1.3);
        const entries = new Map();
        let x = 0, y = 0;
        for (const d of decals) {
            const key = `${d.text}\u0000${d.color}`;
            if (entries.has(key))
                continue;
            const w = Math.min(W, Math.ceil(ctx.measureText(d.text).width + E * 0.3));
            if (x + w > W) {
                x = 0;
                y += rowH + 4;
            }
            entries.set(key, { x, y, w, h: rowH, text: d.text, color: d.color });
            x += w + 4;
        }
        canvas.width = W;
        canvas.height = THREE.MathUtils.ceilPowerOfTwo(y + rowH + 4);
        const H = canvas.height;
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const e of entries.values()) {
            ctx.fillStyle = e.color;
            ctx.fillText(e.text, e.x + e.w / 2, e.y + e.h / 2);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 8;
        this.decalTexture = tex;

        const n = decals.length;
        const pos = new Float32Array(n * 12), uvs = new Float32Array(n * 8), idx = new Uint16Array(n * 6);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let i = 0; i < n; i++) {
            const d = decals[i], e = entries.get(`${d.text}\u0000${d.color}`);
            const hw = (e.w / E) * d.size / 2, hh = (e.h / E) * d.size / 2, th = d.rotation || 0;
            // Text right (ax) and text up (ay), as the software renderer's transform laid them out.
            const ax = d.ground ? [Math.cos(th), 0, -Math.sin(th)] : [-1, 0, 0];
            const ay = d.ground ? [-Math.sin(th), 0, -Math.cos(th)] : [0, 1, 0];
            for (let k = 0; k < 4; k++) {
                const [su, sv] = corners[k], o = (i * 4 + k) * 3, q = (i * 4 + k) * 2;
                pos[o] = d.x + ax[0] * hw * su + ay[0] * hh * sv;
                pos[o + 1] = d.y + ax[1] * hw * su + ay[1] * hh * sv;
                pos[o + 2] = d.z + ax[2] * hw * su + ay[2] * hh * sv;
                uvs[q] = (e.x + (su > 0 ? e.w : 0)) / W;
                uvs[q + 1] = 1 - (e.y + (sv > 0 ? 0 : e.h)) / H;
            }
            idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        geo.computeBoundingSphere();
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
        mat.forceSinglePass = true;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 1;
        return mesh;
    }

    // ---- dynamic: every moving brick in one batch
    buildDynamic() {
        const mesh = this.kit.instanced(this.box, new THREE.MeshBasicMaterial({ vertexColors: true }), DYNAMIC_CAP);
        const alloc = mesh.instanceMatrix.count;
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(alloc * 3), 3);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.count = 0;
        this.dynamic = mesh;
        this.scene.add(mesh);
        const mats = mesh.instanceMatrix.array, cols = mesh.instanceColor.array;
        this.dynCount = 0;
        // Called by stadium.js for each brick (bound once, so the frame loop allocates nothing).
        this.writeBox = (x, y, z, w, h, d, color) => {
            const i = this.dynCount;
            if (i >= DYNAMIC_CAP)
                return;
            this.dynCount = i + 1;
            writeTRS(mats, i * 16, x, y, z, w, h, d);
            const c = rgb(color), k = i * 3;
            cols[k] = c[0];
            cols[k + 1] = c[1];
            cols[k + 2] = c[2];
        };
    }

    // ---- markers: contact shadows, the control ring, dashed routes
    buildMarkers() {
        const shadowGeo = new THREE.CircleGeometry(1, 22).rotateX(-Math.PI / 2);
        const shadowMat = new THREE.MeshBasicMaterial({ color: '#092623', transparent: true, opacity: 0.22, depthWrite: false });
        this.shadows = this.kit.instanced(shadowGeo, shadowMat, SHADOW_CAP);
        this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shadows.frustumCulled = false;
        this.shadows.count = 0;
        this.shadows.renderOrder = 2;
        this.scene.add(this.shadows);

        this.ring = new THREE.Mesh(new THREE.RingGeometry(1.84, 2.16, 44).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe375' }));
        this.ring.visible = false;
        this.scene.add(this.ring);

        const geo = new THREE.BufferGeometry();
        this.routePos = new THREE.BufferAttribute(new Float32Array(DASH_CAP * 12), 3);
        this.routePos.setUsage(THREE.DynamicDrawUsage);
        const idx = new Uint16Array(DASH_CAP * 6);
        for (let i = 0; i < DASH_CAP; i++)
            idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
        geo.setAttribute('position', this.routePos);
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        geo.setDrawRange(0, 0);
        this.routes = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffe688', transparent: true, opacity: 0.75, depthWrite: false }));
        this.routes.frustumCulled = false;
        this.routes.renderOrder = 3;
        this.routes.visible = false;
        this.scene.add(this.routes);
    }

    /** Dashed ribbons from each receiver along its route (rebuilt only when the formation changes). */
    buildRoutes(f) {
        const p = this.routePos.array;
        let n = 0;
        const dash = 0.8, gap = 0.6, hw = 0.12;
        for (const a of f.actors) {
            if (!a.eligible || !a.route.length)
                continue;
            let px = a.x, pz = a.z, phase = 0;
            for (const v of a.route) {
                const dx = v.x - px, dz = v.z - pz, len = Math.hypot(dx, dz);
                if (len < 0.01)
                    continue;
                const tx = dx / len, tz = dz / len, nx = -tz * hw, nz = tx * hw;
                let s = -phase;
                while (s < len && n < DASH_CAP) {
                    const s0 = Math.max(0, s), s1 = Math.min(len, s + dash);
                    if (s1 > s0) {
                        const ax = px + tx * s0, az = pz + tz * s0, bx = px + tx * s1, bz = pz + tz * s1, o = n * 12;
                        p[o] = ax - nx; p[o + 1] = ROUTE_Y; p[o + 2] = az - nz;
                        p[o + 3] = ax + nx; p[o + 4] = ROUTE_Y; p[o + 5] = az + nz;
                        p[o + 6] = bx + nx; p[o + 7] = ROUTE_Y; p[o + 8] = bz + nz;
                        p[o + 9] = bx - nx; p[o + 10] = ROUTE_Y; p[o + 11] = bz - nz;
                        n++;
                    }
                    s += dash + gap;
                }
                // Carry the dash pattern around corners, like a stroked polyline.
                phase = (phase + len) % (dash + gap);
                px = v.x;
                pz = v.z;
            }
        }
        this.routePos.needsUpdate = true;
        this.routes.geometry.setDrawRange(0, n * 6);
        this.routeDashes = n;
    }

    // ---- jersey numbers: one instanced quad per back and per chest, from a 10×10 digit atlas
    buildNumbers() {
        const cell = 128, canvas = document.createElement('canvas');
        canvas.width = canvas.height = cell * 10;
        const ctx = canvas.getContext('2d');
        ctx.font = `900 ${Math.round(cell * 0.74)}px Arial, Helvetica, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff3d7';
        for (let n = 0; n < 100; n++)
            ctx.fillText(String(n), (n % 10 + 0.5) * cell, (Math.floor(n / 10) + 0.54) * cell, cell * 0.96);
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
        const mesh = this.kit.instanced(new THREE.PlaneGeometry(1, 1), mat, NUMBER_CAP);
        this.numberAttr = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count), 1);
        this.numberAttr.setUsage(THREE.DynamicDrawUsage);
        const num = instancedBufferAttribute(this.numberAttr);
        const col = num.mod(10), row = num.div(10).floor();
        mat.colorNode = texture(tex, uv().add(vec2(col, row.oneMinus().add(8))).div(10));
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.count = 0;
        mesh.renderOrder = 4;
        this.numbers = mesh;
        this.scene.add(mesh);
    }

    /** World point → CSS pixels in the 3D view (a reused object). */
    project(p) { return this.rig.project(p); }

    /** The crowd jumps: 0..1, decays by itself. */
    cheerFor(amount) { this.cheerLevel = Math.max(this.cheerLevel, amount); }

    render(f, dt) {
        const r = this.rig;
        r.update(f, this.w, this.h, dt);
        const cam = this.camera;
        cam.left = -r.cx / r.scale;
        cam.right = (this.w - r.cx) / r.scale;
        cam.top = r.cy / r.scale;
        cam.bottom = -(this.h - r.cy) / r.scale;
        // Orthographic: distance does not change the picture, so stand well back of everything.
        cam.position.set(r.target.x - r.forward.x * 400, r.target.y - r.forward.y * 400, r.target.z - r.forward.z * 400);
        cam.lookAt(r.target.x, r.target.y, r.target.z);
        cam.updateProjectionMatrix();

        this.dynCount = 0;
        writeDynamic(f, this.writeBox);
        const dyn = this.dynamic;
        dyn.count = this.dynCount;
        flagUpload(dyn.instanceMatrix, this.dynCount);
        flagUpload(dyn.instanceColor, this.dynCount);

        this.writeMarkers(f);
        this.cheerLevel = Math.max(0, this.cheerLevel - dt * 0.35);
        this.cheer.value = this.cheerLevel;
        this.kit.renderer.render(this.scene, cam);
    }

    writeMarkers(f) {
        const actors = f.actors;
        // Contact shadows under every player (the original's soft ellipses).
        const sm = this.shadows.instanceMatrix.array;
        let n = 0;
        for (const a of actors) {
            if (n >= SHADOW_CAP)
                break;
            writeTRS(sm, n * 16, a.x + 0.6, 0.25, a.z + 0.55, 1.5, 1, 1.05);
            n++;
        }
        this.shadows.count = n;
        this.shadows.visible = n > 0;
        flagUpload(this.shadows.instanceMatrix, n);

        // Numbers on the back and chest of every upright player.
        const nm = this.numbers.instanceMatrix.array, nums = this.numberAttr.array;
        let k = 0;
        for (const a of actors) {
            if (a.fallen > 0 || k + 2 > NUMBER_CAP)
                continue;
            const lift = Math.sin(a.jump * Math.PI) * 2.15, y = 2.02 + lift, off = 0.645 * a.facing;
            // Back plate faces away from where the player looks; the chest plate faces forward.
            writeTRS(nm, k * 16, a.x, y, a.z - off, 0.98, 0.98, 0.98, a.facing > 0);
            nums[k++] = a.player.number;
            writeTRS(nm, k * 16, a.x, y, a.z + off, 0.98, 0.98, 0.98, a.facing < 0);
            nums[k++] = a.player.number;
        }
        this.numbers.count = k;
        this.numbers.visible = k > 0;
        flagUpload(this.numbers.instanceMatrix, k);
        this.numberAttr.clearUpdateRanges();
        this.numberAttr.addUpdateRange(0, Math.max(1, k));
        this.numberAttr.needsUpdate = true;

        // The yellow ring under the player you control.
        const sel = f.lobby ? null : actors[f.selected];
        this.ring.visible = !!sel && sel.id === f.selected;
        if (this.ring.visible)
            this.ring.position.set(sel.x, 0.3, sel.z);

        // Routes during the huddle.
        const showRoutes = !!f.routes && !f.lobby;
        if (showRoutes && this.routeKey !== f.formation) {
            this.routeKey = f.formation;
            this.buildRoutes(f);
        }
        this.routes.visible = showRoutes && this.routeDashes > 0;
    }

    /** Compile every pipeline up front, so the first snap does not hitch. */
    async warm(f) {
        this.render(f, 1 / 60);
        // The ring and the routes first show in a huddle: compile them now too.
        const ring = this.ring.visible, routes = this.routes.visible;
        this.ring.visible = this.routes.visible = true;
        try {
            await this.kit.renderer.compileAsync(this.scene, this.camera);
        }
        catch {
            /* the first frames compile instead */
        }
        this.ring.visible = ring;
        this.routes.visible = routes;
    }
}
