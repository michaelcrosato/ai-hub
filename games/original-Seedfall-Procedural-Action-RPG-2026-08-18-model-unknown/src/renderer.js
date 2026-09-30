import * as THREE from "three/webgpu";
import { BIOMES } from "./data.js";
import { clamp, lerp } from "./util.js";

const _sky = new THREE.Color();
const _hit = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _project = new THREE.Vector3();

/**
 * The scene, camera and lights. The renderer itself comes from the kit
 * (WebGPU with the WebGL2 fallback); this class only owns what is drawn.
 */
export class SceneRenderer {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 1, 0.1, 900);
  renderer;
  kit;
  worldRoot = new THREE.Group();
  dynamicRoot = new THREE.Group();
  effectsRoot = new THREE.Group();
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  cameraTarget = new THREE.Vector3();
  cameraLook = new THREE.Vector3();
  shakeStrength = 0;
  zoom = 1;
  desiredZoom = 1;
  currentBiome = "plains";
  timeOfDay = 0.28;
  hemisphere;
  sun;
  /** Lights the dungeon entry hall. It always exists (dark on the surface) so no pipeline is rebuilt on entry. */
  dungeonLight;
  prewarmGroup = null;

  constructor(kit) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    kit.fitCamera(this.camera);
    this.scene.add(this.worldRoot, this.dynamicRoot, this.effectsRoot);
    this.scene.background = new THREE.Color(BIOMES.plains.fog);
    this.scene.fog = new THREE.FogExp2(BIOMES.plains.fog, 0.0115);
    this.hemisphere = new THREE.HemisphereLight(0xdaf1ff, 0x2c362b, 2.15);
    this.hemisphere.name = "hemisphere";
    this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(0xfff1ce, 2.35);
    this.sun.name = "sun";
    this.sun.position.set(18, 30, 12);
    this.scene.add(this.sun);
    const fill = new THREE.DirectionalLight(0x8fa8d8, 0.35);
    fill.position.set(-18, 16, -14);
    this.scene.add(fill);
    this.dungeonLight = new THREE.PointLight(0xffffff, 0, 90, 2);
    this.dungeonLight.position.set(0, -50, 0);
    this.scene.add(this.dungeonLight);
    this.camera.position.set(0, 25, 22);
    this.camera.lookAt(0, 0, 0);
  }

  get canvas() {
    return this.renderer.domElement;
  }

  /** Where a normalised screen point (-1..1, y up) meets the ground plane at height y. */
  screenToGround(nx, ny, y = 0) {
    this.pointer.set(nx, ny);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.groundPlane.constant = -y;
    if (this.raycaster.ray.intersectPlane(this.groundPlane, _hit)) {
      return { x: _hit.x, z: _hit.z };
    }
    return { x: this.cameraTarget.x, z: this.cameraTarget.z };
  }

  /** CSS-pixel position of a world point, or null when it is behind the camera. */
  worldToScreen(x, y, z, out = { x: 0, y: 0 }) {
    _project.set(x, y, z).project(this.camera);
    if (_project.z > 1) return null;
    out.x = (_project.x * 0.5 + 0.5) * this.kit.size.width;
    out.y = (-_project.y * 0.5 + 0.5) * this.kit.size.height;
    return out;
  }

  setCameraTarget(target, dt) {
    this.cameraTarget.set(target.x, 0, target.z);
    this.zoom = lerp(this.zoom, this.desiredZoom, 1 - Math.exp(-dt * 8));
    _offset.set(0, this.zoom * 24, this.zoom * 20);
    _desired.copy(this.cameraTarget).add(_offset);
    if (this.shakeStrength > 0.001) {
      _desired.x += (Math.random() - 0.5) * this.shakeStrength;
      _desired.y += (Math.random() - 0.5) * this.shakeStrength * 0.3;
      _desired.z += (Math.random() - 0.5) * this.shakeStrength;
    }
    this.camera.position.lerp(_desired, 1 - Math.exp(-dt * 9));
    this.cameraLook.lerp(this.cameraTarget, 1 - Math.exp(-dt * 12));
    this.camera.lookAt(this.cameraLook);
    this.shakeStrength = Math.max(0, this.shakeStrength - dt * 8);
  }

  /** Snap the camera onto the target (after a teleport: new game, dungeon, respawn). */
  snapCamera(target) {
    this.cameraTarget.set(target.x, 0, target.z);
    this.cameraLook.copy(this.cameraTarget);
    this.camera.position.set(target.x, this.zoom * 24, target.z + this.zoom * 20);
    this.camera.lookAt(this.cameraLook);
  }

  adjustZoom(amount) {
    this.desiredZoom = clamp(this.desiredZoom + amount * 0.08, 0.78, 1.3);
  }

  /** Controller zoom: step through close, normal and far. */
  cycleZoom() {
    const steps = [0.78, 1, 1.3];
    const next = steps.find((s) => s > this.desiredZoom + 0.01);
    this.desiredZoom = next ?? steps[0];
  }

  shake(amount) {
    this.shakeStrength = Math.max(this.shakeStrength, amount);
  }

  setBiome(biome) {
    this.currentBiome = biome;
  }

  setTimeOfDay(time) {
    this.timeOfDay = time % 1;
  }

  render(dt = 1 / 60) {
    const biome = BIOMES[this.currentBiome] ?? BIOMES.plains;
    const daylight = Math.max(0.2, Math.sin(this.timeOfDay * Math.PI * 2 - Math.PI / 2) * 0.45 + 0.55);
    _sky.setHex(biome.fog).multiplyScalar(0.55 + daylight * 0.45);
    // The original eased 2.5% per frame at 60 fps; the same pace at any frame rate.
    const k = 1 - Math.exp(-dt * 1.52);
    this.scene.background.lerp(_sky, k);
    this.scene.fog.color.lerp(_sky, k);
    this.sun.intensity = 0.75 + daylight * 1.6;
    this.hemisphere.intensity = 0.95 + daylight * 1.25;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Compile the scene and the material kinds that combat and loot bring in
   * later (fading rings, trails, bolts, health bars), so the first swing does
   * not stall on a shader build. The sample meshes stay in the scene, hidden,
   * so their pipelines stay cached for the real effects.
   */
  prewarm() {
    if (this.prewarmGroup) return;
    const group = new THREE.Group();
    group.name = "prewarm";
    const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, flatShading: true }),
    ];
    for (const material of materials) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.position.set(this.cameraTarget.x, -60, this.cameraTarget.z);
      group.add(mesh);
    }
    this.prewarmGroup = group;
    this.scene.add(group);
    const hide = () => {
      group.visible = false;
    };
    this.renderer.compileAsync(this.scene, this.camera).then(hide, hide);
  }

  clearDynamic() {
    while (this.dynamicRoot.children.length) {
      this.dynamicRoot.remove(this.dynamicRoot.children[0]);
    }
    while (this.effectsRoot.children.length) {
      this.effectsRoot.remove(this.effectsRoot.children[0]);
    }
  }
}
