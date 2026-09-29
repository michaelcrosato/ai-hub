// Sun (cascaded soft shadows), sky and fog across the day, the player's flashlight
// and the cheap blob contact shadows used on the low tier.
import * as THREE from 'three/webgpu';
import { SoftCSMShadowNode } from './softShadows.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => v * v * (3 - 2 * v);

export class Lighting {
  constructor(scene, contactPoints, director) {
    this.scene = scene;
    this.director = director;
    this.sunTarget = new THREE.Object3D();
    this.flashlightTarget = new THREE.Object3D();
    this.daySky = new THREE.Color('#a9c7cf');
    this.eveningSky = new THREE.Color('#33445a');
    this.nightSky = new THREE.Color('#030609');
    this.daySun = new THREE.Color('#fff4d7');
    this.eveningSun = new THREE.Color('#ff9d67');
    this.nightHemisphere = new THREE.Color('#151b24');
    this.nightGround = new THREE.Color('#030405');
    this.nightAmbient = new THREE.Color('#101726');
    this.tmpColor = new THREE.Color();
    this.aimOrigin = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3();
    this.previousAimOrigin = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0);
    this.previousAimDirection = new THREE.Vector3();
    this.quality = 'medium';
    this.contactsEnabled = true;
    this.flashlightEnabled = false;
    this.sunActive = false;
    this.daylight = 0; // 0..1 sun strength, 0 at night

    scene.background = this.nightSky.clone();
    this.fog = new THREE.Fog(this.nightSky.clone(), 22, 67);
    scene.fog = this.fog;
    this.hemisphere = new THREE.HemisphereLight('#151b24', '#030405', 0.035);
    this.ambient = new THREE.AmbientLight('#101726', 0.018);
    scene.add(this.hemisphere, this.ambient);

    this.sun = new THREE.DirectionalLight(this.daySun, 0);
    this.sun.name = 'sun-csm';
    this.sun.castShadow = true;
    this.sun.shadow.bias = -35e-5;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.25;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.autoUpdate = false;
    this.sun.shadow.needsUpdate = true;
    this.sun.target = this.sunTarget;
    this.csm = new SoftCSMShadowNode(this.sun, { cascades: 4, maxFar: 56, mode: 'practical', lightMargin: 48 });
    this.csm.fade = true;
    this.sun.shadow.shadowNode = this.csm;
    scene.add(this.sunTarget, this.sun);

    // Before the first render the CSM has no cascades yet; afterwards each cascade has a shadow.
    const sunOnly = [this.sun.shadow];
    let cascades = [];
    this.sunHandle = director.add({
      id: 'sun',
      label: 'Directional sun',
      fixture: 'directional-sun',
      zone: 'exterior',
      mobility: 'animated',
      light: this.sun,
      root: this.sun,
      intensity: 3.8,
      sourceRadius: 0.62,
      importance: 1,
      shadow: 'important',
      shadowMinQuality: 'low',
      shadowFps: { low: 12, medium: 20, high: 30, ultra: 60 },
      shadowProvider: () => {
        const lights = this.csm.lights;
        if (!lights.length) return sunOnly;
        if (cascades.length !== lights.length) cascades = lights.map((l) => l.shadow).filter(Boolean);
        return cascades;
      },
      onQualityChanged: (q) => {
        this.csm.maxFar = q.sunDistance;
        if (this.csm.camera) this.csm.updateFrustums();
      },
    });

    this.flashlight = new THREE.SpotLight('#e7f1ff', 115, 18, Math.PI * 0.115, 0.52, 2);
    this.flashlight.name = 'player-flashlight';
    this.flashlight.target = this.flashlightTarget;
    this.flashlight.castShadow = true;
    this.flashlight.shadow.bias = -3e-4;
    this.flashlight.shadow.normalBias = 0.028;
    this.flashlight.shadow.camera.near = 0.2;
    this.flashlight.shadow.camera.far = 18;
    this.flashlight.shadow.autoUpdate = false;
    scene.add(this.flashlightTarget, this.flashlight);
    this.flashlightHandle = director.add({
      id: 'flashlight',
      label: 'Flashlight',
      fixture: 'camera-flashlight',
      zone: 'player',
      mobility: 'camera',
      light: this.flashlight,
      root: this.flashlight,
      intensity: 115,
      temperatureK: 6100,
      sourceRadius: 0.16,
      importance: 1,
      shadow: 'important',
      shadowMinQuality: 'low',
      shadowDistance: 18,
      shadowFps: { low: 24, medium: 30, high: 0, ultra: 0 },
    });
    this.flashlightControl = {
      id: 'flashlight',
      label: 'Flashlight',
      root: this.flashlight,
      maxDistance: 0,
      isEnabled: () => this.flashlightEnabled,
      setEnabled: (on) => this.setFlashlight(on),
    };

    // Soft blob shadows under props and the player: the low tier's stand-in for AO.
    this.contactTexture = this.createContactTexture();
    this.staticContactMaterial = new THREE.MeshBasicMaterial({ color: '#111713', map: this.contactTexture, transparent: true, depthWrite: false, opacity: 0.8 });
    this.playerContactMaterial = this.staticContactMaterial.clone();
    this.playerContactMaterial.opacity = 0.78;
    const quad = new THREE.PlaneGeometry(1, 1);
    this.staticContacts = new THREE.InstancedMesh(quad, this.staticContactMaterial, contactPoints.length);
    this.staticContacts.name = 'contact-shadows';
    const o = new THREE.Object3D();
    contactPoints.forEach((c, i) => {
      o.position.set(c.x, 0.022, c.z);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.scale.set(c.sizeX, c.sizeZ, 1);
      o.updateMatrix();
      this.staticContacts.setMatrixAt(i, o.matrix);
    });
    this.staticContacts.instanceMatrix.needsUpdate = true;
    this.staticContacts.computeBoundingSphere();
    this.staticContacts.renderOrder = 2;
    this.staticContacts.matrixAutoUpdate = false;
    this.staticContacts.updateMatrix();
    scene.add(this.staticContacts);
    this.staticContacts.updateMatrixWorld(true);
    this.staticContacts.matrixWorldAutoUpdate = false;
    this.playerContact = new THREE.Mesh(quad, this.playerContactMaterial);
    this.playerContact.rotation.x = -Math.PI / 2;
    this.playerContact.scale.set(1.5, 1.3, 1);
    this.playerContact.position.y = 0.026;
    this.playerContact.renderOrder = 3;
    scene.add(this.playerContact);

    this.setFlashlight(false);
    this.setDayPhase(1, false);
  }

  createContactTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,0.88)');
      g.addColorStop(0.32, 'rgba(255,255,255,0.56)');
      g.addColorStop(0.68, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    return new THREE.CanvasTexture(canvas);
  }

  /** 0 = clear day, ~0.64 = sunset, 1 = moonless night. */
  setDayPhase(phase, invalidate = true) {
    const n = smooth(clamp01(phase));
    const sunStrength = 1 - smooth(clamp01((n - 0.58) / 0.37));
    const azimuth = 0.55 + n * 1.35;
    const elevation = 0.96 - n * 0.82;
    const dist = 47;
    const flat = Math.cos(elevation) * dist;
    this.sun.position.set(Math.cos(azimuth) * flat, Math.sin(elevation) * dist, Math.sin(azimuth) * flat);
    this.sun.color.copy(this.tmpColor.lerpColors(this.daySun, this.eveningSun, n));
    this.sun.intensity = 3.8 * sunStrength;
    this.sunActive = sunStrength > 0.012;
    this.daylight = sunStrength;
    this.hemisphere.color.set('#d7efff').lerp(this.nightHemisphere, n);
    this.hemisphere.groundColor.set('#575544').lerp(this.nightGround, n);
    this.hemisphere.intensity = 0.035 + sunStrength * 0.72;
    this.ambient.color.set('#b8c0b4').lerp(this.nightAmbient, n);
    this.ambient.intensity = 0.018 + sunStrength * 0.1;
    const sky = n < 0.72
      ? this.tmpColor.lerpColors(this.daySky, this.eveningSky, smooth(n / 0.72))
      : this.tmpColor.lerpColors(this.eveningSky, this.nightSky, smooth((n - 0.72) / 0.28));
    if (this.scene.background?.isColor) this.scene.background.copy(sky);
    this.fog.color.copy(sky);
    this.fog.near = 29 - n * 7;
    this.fog.far = 82 - n * 15;
    if (invalidate && this.sunActive) this.sunHandle.invalidate();
  }

  setFlashlight(on) {
    this.flashlightEnabled = on;
    this.flashlightHandle.setEnabled(on);
    if (on) this.flashlightHandle.invalidate(true);
  }

  /** Keep the flashlight on the aim ray (only touches matrices when the aim moved). */
  update(player) {
    player.getAimRay(this.aimOrigin, this.aimDirection);
    if (this.aimOrigin.distanceToSquared(this.previousAimOrigin) < 1e-12 && this.aimDirection.distanceToSquared(this.previousAimDirection) < 1e-12) return;
    this.previousAimOrigin.copy(this.aimOrigin);
    this.previousAimDirection.copy(this.aimDirection);
    this.flashlight.position.copy(this.aimOrigin).addScaledVector(this.aimDirection, 0.68);
    this.flashlight.position.y += 0.08;
    this.flashlightTarget.position.copy(this.aimDirection).multiplyScalar(15).add(this.aimOrigin);
    this.flashlight.updateMatrixWorld(true);
    this.flashlightTarget.updateMatrixWorld(true);
    if (this.flashlightEnabled) this.flashlightHandle.invalidate();
  }

  setContactShadows(on) {
    this.contactsEnabled = on;
    this.updateContactVisibility();
  }

  updatePlayerContact(position, floorY, airHeight) {
    this.playerContact.position.set(position.x, floorY + 0.028, position.z);
    const fade = 1 - Math.min(0.72, Math.max(0, airHeight) * 0.28);
    this.playerContact.scale.set(1.5 + airHeight * 0.08, 1.3 + airHeight * 0.08, 1);
    this.playerContactMaterial.opacity = 0.78 * fade;
    this.playerContact.visible = this.contactsEnabled && this.quality === 'low';
  }

  setShadowQuality(quality) {
    this.quality = quality;
    this.updateContactVisibility();
  }

  updateContactVisibility() {
    const on = this.contactsEnabled && this.quality === 'low';
    this.staticContacts.visible = on;
    this.playerContact.visible = on;
  }

  /** The camera changed shape (resize, FOV): re-split the cascades. */
  updateFrustums() {
    if (this.csm.camera) this.csm.updateFrustums();
    this.director.invalidateCamera();
  }
}
