import * as THREE from 'three/webgpu';
import { bakeInstances } from 'kit/instancing.js';
import { buildArena, emitDynamic, rinkCanvas, scoreboardCanvas, paintScoreboard, venueOf } from './art.js';
import { RINK, portraitView, viewYaw } from './math.js';

export const VIEW = { yaw: .23, elevation: .78 };
const DYNAMIC_CAPACITY = 1600;
const SHADOW_CAPACITY = 14;

/**
 * The broadcast camera: an orthographic view from a fixed angle. It frames the
 * whole rink ('broadcast', 'wide') or follows the puck up close ('follow').
 * cx/cy are where the world origin lands on screen, scale is pixels per meter.
 */
export class Camera {
    width = 1;
    height = 1;
    scale = 1;
    cx = 0;
    cy = 0;
    yaw = VIEW.yaw;
    set(width, height, menu, mode = 'broadcast', focus = null) {
        this.width = width;
        this.height = height;
        this.yaw = viewYaw(width, height);
        const portrait = portraitView(width, height);
        this.scale = Math.min(width / (portrait ? (menu ? 69 : 57) : menu ? 111 : 91), height / (portrait ? 110 : menu ? 61 : 57)) * (mode === 'wide' && !menu ? .88 : 1);
        this.cx = width * .5 + (menu && width > 850 ? width * .105 : 0);
        this.cy = height * (portrait ? (menu ? .55 : .44) : menu ? .475 : .515);
        if (focus && !menu) {
            // Close follow: zoom in and keep the focus point near the centre, without leaving the arena.
            this.scale *= portrait ? 1.5 : 2;
            const sy = Math.sin(this.yaw), cyaw = Math.cos(this.yaw), se = Math.sin(VIEW.elevation);
            const screen = (x, z) => [x * cyaw - z * sy, (x * sy + z * cyaw) * se];
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const x of [-RINK.halfLength - 3, RINK.halfLength + 3])
                for (const z of [-RINK.halfWidth - 4.5, RINK.halfWidth + 3]) {
                    const [u, v] = screen(x, z);
                    minX = Math.min(minX, u);
                    maxX = Math.max(maxX, u);
                    minY = Math.min(minY, v);
                    maxY = Math.max(maxY, v);
                }
            const halfW = width / 2 / this.scale, halfH = height / 2 / this.scale;
            let [u, v] = screen(focus.x, focus.z);
            u = minX + halfW <= maxX - halfW ? Math.min(maxX - halfW, Math.max(minX + halfW, u)) : (minX + maxX) / 2;
            v = minY + halfH <= maxY - halfH ? Math.min(maxY - halfH, Math.max(minY + halfH, v)) : (minY + maxY) / 2;
            this.cx = width / 2 - u * this.scale;
            this.cy = height * .5 - v * this.scale;
        }
    }
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

function composeBrick(target, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) {
    _p.set(x, y, z);
    _s.set(w, h, d);
    _e.set(rx, ry, rz, 'YZX');
    _q.setFromEuler(_e);
    return target.compose(_p, _q, _s);
}

/** three.js r186 on the kit's renderer: one baked mesh for the arena, one instanced batch for everything that moves. */
export class ArenaRenderer {
    camModel = new Camera();
    focus = { x: 0, z: 0 };
    colors = new Map();
    venue = '';
    lastBoard = '';
    constructor(kit, game) {
        this.kit = kit;
        this.renderer = kit.renderer;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#eaf2ef');
        this.camera = new THREE.OrthographicCamera(-45, 45, 30, -30, .1, 250);
        this.hemi = new THREE.HemisphereLight('#f5ffff', '#8bacba', 2.5);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight('#fff6df', 3.2);
        this.sun.position.set(-20, 45, 30);
        this.scene.add(this.sun);
        this.fill = new THREE.DirectionalLight('#a7e4ff', 1);
        this.fill.position.set(30, 15, -20);
        this.scene.add(this.fill);
        this.box = new THREE.BoxGeometry(1, 1, 1);
        // Arena: one material for every static brick (colours ride in the vertices).
        this.staticMaterial = new THREE.MeshStandardMaterial({ roughness: .66, metalness: .025, vertexColors: true });
        this.staticMesh = null;
        // Ice: the canvas is repainted in place when the venue changes.
        this.iceCanvas = document.createElement('canvas');
        this.iceTexture = new THREE.CanvasTexture(this.iceCanvas);
        this.iceTexture.colorSpace = THREE.SRGBColorSpace;
        this.iceTexture.anisotropy = 4;
        const ice = new THREE.Mesh(new THREE.PlaneGeometry(61, 26), new THREE.MeshStandardMaterial({ map: this.iceTexture, roughness: .24, metalness: .06, alphaTest: .5 }));
        ice.rotation.x = -Math.PI / 2;
        ice.position.y = .025;
        this.scene.add(ice);
        // Scoreboard face.
        this.scoreCanvas = scoreboardCanvas();
        this.scoreTexture = new THREE.CanvasTexture(this.scoreCanvas);
        this.scoreTexture.colorSpace = THREE.SRGBColorSpace;
        this.board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.scoreTexture }));
        this.scene.add(this.board);
        // Everything that moves: skaters, puck, sparks, confetti, snow. Colours per instance.
        this.dynamic = kit.instanced(this.box, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .56, metalness: .02 }), DYNAMIC_CAPACITY);
        this.dynamic.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.dynamic.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.dynamic.instanceMatrix.count * 3).fill(1), 3);
        this.dynamic.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.dynamic.frustumCulled = false;
        this.dynamic.count = 0;
        this.scene.add(this.dynamic);
        this.count = 0;
        const matrices = this.dynamic.instanceMatrix.array, colors = this.dynamic.instanceColor.array;
        this.emit = (x, y, z, w, h, d, color, ry, rx, rz) => {
            const i = this.count;
            if (i >= DYNAMIC_CAPACITY)
                return;
            composeBrick(_m, x, y, z, w, h, d, ry, rx, rz).toArray(matrices, i * 16);
            const c = this.color(color);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
            this.count = i + 1;
        };
        // Selection rings under each human's skater: lime for player 1, orange for player 2.
        const ringGeometry = new THREE.RingGeometry(.97, 1.10, 32);
        ringGeometry.rotateX(-Math.PI / 2);
        this.rings = ['#edff7b', '#ffb13b'].map(color => {
            const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color }));
            ring.visible = false;
            this.scene.add(ring);
            return ring;
        });
        // Soft blob shadows under the skaters, one instanced batch.
        this.shadowTexture = this.makeShadowTexture();
        const shadowGeometry = new THREE.PlaneGeometry(2.2, 2.2);
        shadowGeometry.rotateX(-Math.PI / 2);
        this.shadows = kit.instanced(shadowGeometry, new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: .38, depthWrite: false }), SHADOW_CAPACITY);
        this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shadows.frustumCulled = false;
        this.shadows.count = 0;
        this.scene.add(this.shadows);
        this.setVenue(game.settings.venue);
    }
    color(hex) {
        let c = this.colors.get(hex);
        if (!c) {
            c = new THREE.Color(hex);
            this.colors.set(hex, c);
        }
        return c;
    }
    makeShadowTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, '#173f59aa');
        g.addColorStop(.6, '#173f5955');
        g.addColorStop(1, '#173f5900');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    }
    /** Build the static arena for a venue (one merged mesh) and restyle the ice, board and light. */
    setVenue(id) {
        const venue = venueOf(id);
        if (venue.id === this.venue)
            return;
        this.venue = venue.id;
        const bricks = buildArena(venue.id);
        const batch = new THREE.InstancedMesh(this.box, this.staticMaterial, bricks.length);
        bricks.forEach((b, i) => {
            batch.setMatrixAt(i, composeBrick(_m, b.x, b.y, b.z, b.w, b.h, b.d, b.ry, b.rx, b.rz));
            batch.setColorAt(i, this.color(b.color));
        });
        const baked = bakeInstances(batch);
        if (this.staticMesh) {
            this.scene.remove(this.staticMesh);
            this.staticMesh.geometry.dispose();
        }
        this.staticMesh = baked;
        this.scene.add(baked);
        rinkCanvas(venue.id, this.iceCanvas);
        this.iceTexture.needsUpdate = true;
        const s = venue.scoreboard;
        this.board.position.set(s.x, s.y, s.z);
        this.board.scale.set(s.w, s.h, 1);
        this.lastBoard = '';
        this.scene.background.set(venue.background);
        this.hemi.color.set(venue.sky);
        this.hemi.groundColor.set(venue.ground);
        this.sun.color.set(venue.sun);
        this.fill.color.set(venue.fill);
    }
    /** Smoothly track the puck (leading it a little) for the close-follow camera. */
    updateFocus(game, dt, snap) {
        const puck = game.visual().puck, v = game.puck.velocity;
        const tx = puck.x + v.x * .12, tz = puck.z + v.z * .08;
        const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
        this.focus.x += (tx - this.focus.x) * k;
        this.focus.z += (tz - this.focus.z) * k;
    }
    render(game, dt, clock) {
        const { width, height } = this.kit.size, menu = game.phase === 'attract', mode = game.settings.camera;
        if (game.settings.venue !== this.venue)
            this.setVenue(game.settings.venue);
        const follow = mode === 'follow' && !menu;
        if (follow)
            this.updateFocus(game, dt, !this.following);
        this.following = follow;
        const cam = this.camModel;
        cam.set(width, height, menu, mode, follow ? this.focus : null);
        const { scale, cx, cy, yaw } = cam;
        const ce = Math.cos(VIEW.elevation), se = Math.sin(VIEW.elevation);
        this.camera.position.set(Math.sin(yaw) * ce * 120, se * 120, Math.cos(yaw) * ce * 120);
        this.camera.lookAt(0, 0, 0);
        this.camera.left = -cx / scale;
        this.camera.right = (width - cx) / scale;
        this.camera.top = cy / scale;
        this.camera.bottom = -(height - cy) / scale;
        this.camera.updateProjectionMatrix();
        // Moving bricks.
        this.count = 0;
        emitDynamic(game, this.emit, { snow: venueOf(this.venue).snow ? this.kit.detail(170) : 0, confetti: this.kit.detail(65, 24), clock });
        const dyn = this.dynamic;
        dyn.count = this.count;
        if (this.count > 0) {
            // Upload only the slots written this frame.
            dyn.instanceMatrix.clearUpdateRanges();
            dyn.instanceMatrix.addUpdateRange(0, this.count * 16);
            dyn.instanceMatrix.needsUpdate = true;
            dyn.instanceColor.clearUpdateRanges();
            dyn.instanceColor.addUpdateRange(0, this.count * 3);
            dyn.instanceColor.needsUpdate = true;
        }
        // Rings under the human-controlled skaters.
        for (let team = 0; team < 2; team++) {
            const p = game.players[game.selected[team]], ring = this.rings[team === game.settings.team ? 0 : 1];
            ring.visible = !menu && game.isHuman(team) && !!p?.active && game.phase !== 'replay';
            if (ring.visible)
                ring.position.set(p.x, .06, p.z);
        }
        // Blob shadows.
        const players = game.visual().players, n = Math.min(players.length, SHADOW_CAPACITY);
        for (let i = 0; i < n; i++) {
            _m.makeTranslation(players[i].x + .2, .047, players[i].z + .25);
            this.shadows.setMatrixAt(i, _m);
        }
        this.shadows.count = n;
        if (n > 0) {
            this.shadows.instanceMatrix.clearUpdateRanges();
            this.shadows.instanceMatrix.addUpdateRange(0, n * 16);
            this.shadows.instanceMatrix.needsUpdate = true;
        }
        // Scoreboard face, repainted only when what it shows changes.
        const duel = game.phase === 'duel' || game.phase === 'duel-result' || game.phase === 'shootout-intro';
        const boardKey = `${game.score[0]}:${game.score[1]}:${game.period}:${Math.floor(game.clock)}:${menu}:${duel}:${game.duelIsShootout}`;
        if (boardKey !== this.lastBoard) {
            this.lastBoard = boardKey;
            paintScoreboard(this.scoreCanvas, game, this.venue);
            this.scoreTexture.needsUpdate = true;
        }
        this.renderer.render(this.scene, this.camera);
    }
    /** Compile the pipelines up front so the first frames of play do not hitch. */
    async warm(game) {
        this.count = 0;
        emitDynamic(game, this.emit, { snow: 0, confetti: 0, clock: 0 });
        this.dynamic.count = this.count;
        this.shadows.count = 1;
        this.rings.forEach(r => (r.visible = true));
        try {
            await this.renderer.compileAsync(this.scene, this.camera);
        }
        catch { /* compiling ahead is only an optimisation */ }
        this.rings.forEach(r => (r.visible = false));
    }
}
