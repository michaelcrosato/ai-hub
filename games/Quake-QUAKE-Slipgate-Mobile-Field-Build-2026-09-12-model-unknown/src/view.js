// The three.js side, drawn with the kit's renderer (WebGPU, WebGL2 fallback): one merged mesh per
// material for the arena, instanced batches for everything that moves (all sharing one shader per
// material), the view-model weapons on the camera, the torch and gate lights, and one light that
// the muzzle flash and explosions borrow.
import * as THREE from 'three/webgpu';
import { texture, uv, vec2, vec3, time, sin, uniform } from 'three/tsl';
import { MATERIALS, makeTextures } from './textures.js';
import { MODEL_ALIAS, WEAPON_MODELS } from './world.js';

const CAPACITY = 192;
// The view model is scaled in toward the eye. From the camera it looks exactly the same, but it
// now ends 0.29 m out, inside the player's 0.32 m collision radius, so it never pokes into walls.
const WEAPON_SCALE = 0.28;
const MUZZLE = { shotgun: [0.19, -0.17, -1.04], nailgun: [0.19, -0.19, -1.03], launcher: [0.18, -0.22, -0.92] };
const NOT_INSTANCED = new Set(['flash', ...WEAPON_MODELS, ...Object.keys(MODEL_ALIAS)]);

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _v = new THREE.Vector3();

function bufferGeometry(g) {
  const b = new THREE.BufferGeometry();
  b.setAttribute('position', new THREE.Float32BufferAttribute(g.positions, 3));
  b.setAttribute('normal', new THREE.Float32BufferAttribute(g.normals, 3));
  b.setAttribute('uv', new THREE.Float32BufferAttribute(g.uvs, 2));
  b.setAttribute('color', new THREE.Float32BufferAttribute(g.colors, 3));
  b.computeBoundingSphere();
  return b;
}

export class View {
  constructor(kit, models) {
    this.kit = kit;
    const renderer = (this.renderer = kit.renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#151d25');
    scene.fog = new THREE.FogExp2('#151d25', 0.018);
    const camera = (this.camera = kit.fitCamera(new THREE.PerspectiveCamera(78, 1, 0.05, 180)));
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    scene.add(new THREE.HemisphereLight(0xb3cfed, 0x52402c, 1.55));
    const sun = new THREE.DirectionalLight(0xc3daff, 1.55);
    sun.position.set(-20, 30, 10);
    scene.add(sun);
    // Muzzle flashes and explosions light the room. Always present, so the light count never
    // changes mid-game (that would rebuild every material).
    this.flashLight = new THREE.PointLight(0xffa452, 0, 11, 2);
    scene.add(this.flashLight);

    this.anisotropy = kit.tier.name === 'low' ? 1 : kit.tier.name === 'medium' ? 4 : 8;
    this.sources = makeTextures();
    this.textures = new Map();
    this.materials = new Map();
    this.portalPower = uniform(1);
    this.world = null;
    this.staticMeshes = [];
    this.lights = [];
    this.pose = { x: 0, y: 0, z: 0, rx: 0, rz: 0, visible: true };
    this.buildModels(models);
  }

  /* --------------------------------------------------------------- textures and materials */

  texture(name) {
    let tex = this.textures.get(name);
    if (tex) return tex;
    const src = this.world?.textures?.[name] || this.sources[name] || this.sources.stone;
    tex = src.data ? new THREE.DataTexture(src.data, src.width, src.height) : new THREE.CanvasTexture(src);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = this.anisotropy;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.name = name;
    tex.needsUpdate = true;
    this.textures.set(name, tex);
    return tex;
  }

  material(name) {
    let mat = this.materials.get(name);
    if (mat) return mat;
    const def = this.world?.materialDefs?.[name] || MATERIALS[name] || MATERIALS.stone;
    const tex = this.texture(def.texture);
    const col = new THREE.Color(def.color[0], def.color[1], def.color[2]);
    if (def.flow) {
      // Lava drifts and the slipgate's runes swirl: the texture coordinates move with time.
      mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.91, metalness: def.metalness || 0, vertexColors: true, side: THREE.DoubleSide });
      const flowUV =
        def.flow === 'lava'
          ? uv().add(vec2(time.mul(0.016), sin(time.mul(0.12)).mul(0.03)))
          : uv().add(vec2(time.mul(0.045), sin(time.mul(0.3)).mul(0.05)));
      const rgb = texture(tex, flowUV).rgb.mul(vec3(col.r, col.g, col.b));
      mat.colorNode = rgb;
      mat.emissiveNode = def.flow === 'portal' ? rgb.mul(this.portalPower) : rgb.mul(def.emissive || 0);
    } else {
      mat = new THREE.MeshStandardMaterial({ map: tex, color: col, roughness: 0.91, metalness: def.metalness || 0, vertexColors: true, side: THREE.DoubleSide });
      if (def.emissive) {
        mat.emissive = col.clone();
        mat.emissiveIntensity = def.emissive;
        mat.emissiveMap = tex;
      }
    }
    mat.name = name;
    this.materials.set(name, mat);
    return mat;
  }

  /* --------------------------------------------------------------- models */

  buildModels(models) {
    this.sets = new Map();
    for (const [name, parts] of Object.entries(models)) {
      if (NOT_INSTANCED.has(name)) continue;
      const meshes = parts.map((part) => {
        // kit.instanced: every batch shares one shader per material instead of compiling its own.
        const mesh = this.kit.instanced(bufferGeometry(part.g), this.material(part.mat), CAPACITY);
        mesh.name = name;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3).fill(1), 3);
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.count = 0;
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
      });
      this.sets.set(name, { meshes, count: 0 });
    }

    this.weaponRoot = new THREE.Group();
    this.weaponRoot.scale.setScalar(WEAPON_SCALE);
    this.camera.add(this.weaponRoot);
    this.weaponPose = new THREE.Group();
    this.weaponRoot.add(this.weaponPose);
    this.weapons = {};
    for (const id of WEAPON_MODELS) {
      const group = new THREE.Group();
      for (const part of models[id]) {
        const mesh = new THREE.Mesh(bufferGeometry(part.g), this.material(part.mat));
        mesh.frustumCulled = false;
        group.add(mesh);
      }
      group.visible = false;
      this.weaponPose.add(group);
      this.weapons[id] = group;
    }
    this.muzzle = new THREE.Mesh(bufferGeometry(models.flash[0].g), this.material(models.flash[0].mat));
    this.muzzle.frustumCulled = false;
    this.muzzle.visible = false;
    this.weaponPose.add(this.muzzle);
  }

  /* --------------------------------------------------------------- the world */

  setWorld(world) {
    for (const mesh of this.staticMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const light of this.lights) {
      this.scene.remove(light);
      light.dispose();
    }
    // A loaded Quake map brings its own textures; drop the last map's before building this one.
    if (this.world?.imported) {
      for (const [name, mat] of this.materials) {
        if (!name.startsWith('pak_')) continue;
        mat.dispose();
        this.materials.delete(name);
      }
      for (const [name, tex] of this.textures) {
        if (!name.startsWith('pak_')) continue;
        tex.dispose();
        this.textures.delete(name);
      }
    }
    this.world = world;
    this.staticMeshes = [];
    this.lights = [];
    for (const [mat, g] of world.batches) {
      const mesh = new THREE.Mesh(bufferGeometry(g), this.material(mat));
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.staticMeshes.push(mesh);
    }
    world.lights.slice(0, 8).forEach((l, i) => {
      const light = new THREE.PointLight(new THREE.Color(l.color[0], l.color[1], l.color[2]), l.power * 1.7, l.range, 2);
      light.position.set(l.pos[0], l.pos[1], l.pos[2]);
      light.userData.base = light.intensity;
      light.userData.flicker = !!l.flicker;
      light.userData.gate = i === world.gateLight;
      light.userData.phase = i * 1.7;
      this.scene.add(light);
      this.lights.push(light);
    });
  }

  /* --------------------------------------------------------------- per frame */

  /** Called by Game.draws for every moving thing. Writes straight into the instance buffers. */
  push(model, x, y, z, rx, ry, rz, s, tr, tg, tb) {
    const set = this.sets.get(MODEL_ALIAS[model] || model);
    if (!set || set.count >= CAPACITY) return;
    _p.set(x, y, z);
    _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
    _s.set(s, s, s);
    _m.compose(_p, _q, _s);
    const i = set.count++;
    for (const mesh of set.meshes) {
      mesh.setMatrixAt(i, _m);
      mesh.instanceColor.setXYZ(i, tr, tg, tb);
    }
  }

  flushInstances() {
    for (const set of this.sets.values()) {
      const n = set.count;
      for (const mesh of set.meshes) {
        mesh.count = n;
        mesh.visible = n > 0;
        if (!n) continue;
        // Upload only the instances in use, not the whole allocation.
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, n * 16);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, n * 3);
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /**
   * Draw one frame. cam: {pos, yaw, pitch, roll, fov}; opts: {menu, elapsed, weapon, t}.
   */
  render(cam, game, opts) {
    const camera = this.camera;
    camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    camera.rotation.set(cam.pitch, cam.yaw, cam.roll || 0, 'YXZ');
    if (camera.fov !== cam.fov) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }

    for (const set of this.sets.values()) set.count = 0;
    game.draws(this, opts.menu, opts.elapsed);
    this.flushInstances();

    // The view-model weapon: sway, recoil, the dip while switching, and the muzzle flash.
    const pose = game.weaponPose(this.pose);
    const showWeapon = !opts.menu && pose.visible && !opts.hideWeapon;
    for (const id of WEAPON_MODELS) this.weapons[id].visible = showWeapon && id === opts.weapon;
    this.weaponPose.position.set(pose.x, pose.y, pose.z);
    this.weaponPose.rotation.set(pose.rx, 0, pose.rz);
    const flash = showWeapon ? game.flash : 0;
    this.muzzle.visible = flash > 0.08;
    if (this.muzzle.visible) {
      const m = MUZZLE[opts.weapon] || MUZZLE.shotgun;
      this.muzzle.position.set(m[0], m[1], m[2]);
      this.muzzle.scale.setScalar(0.55 + flash * 0.9);
      this.muzzle.rotation.set(game.time * 37, game.time * 23, 0);
    }

    // Lights: torches flicker, the gate surges once it opens, the borrowed light follows the
    // brighter of the muzzle flash and the last explosion.
    const t = opts.t;
    const open = !!game.gateOpen;
    for (const light of this.lights) {
      const u = light.userData;
      if (u.gate) light.intensity = u.base * (open ? 1.8 + Math.sin(t * 4) * 0.35 : 1);
      else if (u.flicker) light.intensity = u.base * (0.88 + Math.sin(t * 13 + u.phase) * Math.sin(t * 7.3 + u.phase * 2) * 0.12);
    }
    this.portalPower.value = open ? 2.3 + Math.sin(t * 4) * 0.4 : 1;
    const muzzle = flash * 26;
    const blast = game.blast ? game.blast.power * 75 : 0;
    if (blast > muzzle && blast > 0.5) {
      this.flashLight.position.set(game.blast.pos[0], game.blast.pos[1], game.blast.pos[2]);
      this.flashLight.intensity = blast;
    } else if (muzzle > 0.5) {
      _v.set(0.1, -0.12, -0.75).applyQuaternion(camera.quaternion).add(camera.position);
      this.flashLight.position.copy(_v);
      this.flashLight.intensity = muzzle;
    } else this.flashLight.intensity = 0;

    this.renderer.render(this.scene, this.camera);
  }

  /** Compile every pipeline the game will need, so the first imp or explosion does not stutter. */
  async prewarm(cam) {
    const camera = this.camera;
    camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    camera.rotation.set(cam.pitch, cam.yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
    const restore = [];
    for (const set of this.sets.values()) {
      for (const mesh of set.meshes) {
        mesh.count = 1;
        mesh.visible = true;
        restore.push(mesh);
      }
    }
    for (const id of WEAPON_MODELS) this.weapons[id].visible = true;
    this.muzzle.visible = true;
    try {
      await Promise.race([this.renderer.compileAsync(this.scene, camera), new Promise((resolve) => setTimeout(resolve, 3500))]);
    } catch {
      /* the first frames compile instead */
    }
    for (const mesh of restore) {
      mesh.count = 0;
      mesh.visible = false;
    }
    for (const id of WEAPON_MODELS) this.weapons[id].visible = false;
    this.muzzle.visible = false;
  }

  get calls() {
    return this.renderer.info.render.drawCalls ?? this.renderer.info.render.calls ?? 0;
  }

  get triangles() {
    return this.renderer.info.render.triangles || 0;
  }
}
