import * as THREE from "three/webgpu";
import { BUILDINGS, CONDUITS, GRID, ERAS, ERA_BOARDS } from "./content.js";
import { PartsBuilder, textTexture } from "./geometry.js";

/**
 * The 3D laboratory diorama, drawn with the kit's renderer (WebGPU, WebGL2 fallback).
 * The room, every machine and every person are merged flat-shaded meshes with vertex
 * colours on one shared material; the simulation stays independent of the view.
 */
const LATER = new Set(["gpu", "tpu", "cluster"]);
const START = new THREE.Vector3(14.5, 15.8, 18.5).sub(new THREE.Vector3(0, 0.35, 0));
const HOME = { yaw: Math.atan2(START.x, START.z), polar: Math.acos(START.y / START.length()), dist: START.length(), x: 0, z: 0 };
const LIMITS = { minDist: 12, maxDist: 38, minPolar: 0.28, maxPolar: 1.25, radius: 5 };
const TARGET_Y = 0.35;
const tileX = (x) => x - 4.5;
const tileZ = (z) => z - 3.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const eraIdFor = (year) => (ERAS.find((e) => year >= e.start && year < e.end) || ERAS[6]).id;

export class LabWorld {
  constructor(kit) {
    this.kit = kit;
    this.buildType = null;
    this.layer = null;
    this.rotation = 0;
    this.hover = null;
    this.selectedId = null;
    this.revision = -1;
    this.eraId = -1;
    this.known = null;
    this.buildings = new Map();
    this.agents = [];
    this.agentClock = 0;
    this.geoCache = new Map();
    this.goal = { ...HOME };
    this.view = { ...HOME };

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color("#e9e7dd");
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);

    scene.add(new THREE.HemisphereLight(0xfffbec, 0x99a594, 2.2));
    const sun = new THREE.DirectionalLight(0xfff4df, 3);
    sun.position.set(-8, 17, 9);
    sun.castShadow = true;
    kit.shadow(sun, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0003;
    sun.shadow.radius = 4;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xe6f2ec, 0.7);
    fill.position.set(9, 8, -6);
    scene.add(fill);
    kit.renderer.shadowMap.enabled = true;
    kit.renderer.shadowMap.type = THREE.PCFShadowMap;

    // A handful of shared materials for the whole diorama.
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.hotMat = new THREE.MeshLambertMaterial({ color: "#d69c6a", emissive: "#b65e43", emissiveIntensity: 0.28, flatShading: true });
    this.offMat = new THREE.MeshLambertMaterial({ color: "#7d857a", flatShading: true });
    this.ghostMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.5, depthWrite: false });
    this.ghostBadMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: "#f2a184", flatShading: true, transparent: true, opacity: 0.5, depthWrite: false });
    // The power unit's lightning sign: one texture shared by every unit.
    this.boltMat = new THREE.MeshBasicMaterial({ map: textTexture("⚡", { bg: "#8e9884", fg: "#f2dba2" }), side: THREE.DoubleSide });
    this.boltGeo = new THREE.PlaneGeometry(0.3, 0.22);

    this.fixed = new THREE.Group();
    this.objects = new THREE.Group();
    this.services = new THREE.Group();
    this.people = new THREE.Group();
    this.services.visible = false;
    scene.add(this.fixed, this.objects, this.services, this.people);
    this.makeRoom();

    this.cursorMat = new THREE.MeshBasicMaterial({ color: 0x829776, transparent: true, opacity: 0.55, depthWrite: false });
    this.cursor = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.055, 0.97), this.cursorMat);
    this.cursor.visible = false;
    this.cursor.renderOrder = 2;
    scene.add(this.cursor);

    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
    this.ghost.visible = false;
    this.ghost.renderOrder = 3;
    scene.add(this.ghost);

    // Selection: a clay frame around the tile of the inspected module.
    const frame = new PartsBuilder();
    for (const [w, d, x, z] of [
      [1.02, 0.07, 0, -0.475],
      [1.02, 0.07, 0, 0.475],
      [0.07, 0.88, -0.475, 0],
      [0.07, 0.88, 0.475, 0],
    ])
      frame.box(w, 0.05, d, x, 0, z, "#ffffff");
    this.selectMat = new THREE.MeshBasicMaterial({ color: "#ca9365", vertexColors: true });
    this.selection = new THREE.Mesh(frame.build(), this.selectMat);
    this.selection.visible = false;
    scene.add(this.selection);

    this.serviceMesh = null;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.point = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.updateCamera(1);
  }

  /** Compile every material once at load (including the ones that only appear later). */
  async warm() {
    const probe = new THREE.Group();
    // Same attributes as the real meshes (position, normal, colour), so the same pipelines.
    const geo = new PartsBuilder().box(0.01, 0.01, 0.01, 0, 0, 0, "#ffffff").build();
    for (const m of [this.hotMat, this.offMat, this.ghostMat, this.ghostBadMat]) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(0, -2, 0);
      probe.add(mesh);
    }
    this.scene.add(probe);
    const shown = [this.cursor, this.selection];
    shown.forEach((o) => (o.visible = true));
    try {
      await this.kit.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* pipelines build on first use instead */
    }
    shown.forEach((o) => (o.visible = false));
    this.scene.remove(probe);
    geo.dispose();
  }

  label(parent, text, x, y, z, w = 0.9, h = 0.25, bg = "#536b58", fg = "#e9e5cb", rot = 0) {
    const map = textTexture(text, { bg, fg });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rot;
    parent.add(mesh);
    return mesh;
  }

  makeRoom() {
    const solid = new PartsBuilder();
    const flat = new PartsBuilder();
    flat.box(200, 0.3, 200, 0, -0.65, 0, "#e9e7dd");
    solid.box(10.65, 0.38, 8.65, 0, -0.28, 0, "#a4ab96");
    solid.box(10.45, 0.2, 8.45, 0, -0.04, 0, "#d0c7b1");
    for (let x = 0; x < GRID.w; x++)
      for (let z = 0; z < GRID.h; z++)
        flat.box(0.985, 0.075, 0.985, tileX(x), 0.075, tileZ(z), (x + z) % 3 === 0 ? "#dcd7c6" : (x + z) % 3 === 1 ? "#e3dfd0" : "#e6e1d2");
    // Cutaway walls leave the front and right open to the camera.
    solid.box(10.5, 1.65, 0.16, 0, 0.9, -4.15, "#d1d7c4");
    solid.box(0.16, 1.65, 8.45, -5.18, 0.9, 0, "#c5cfba");
    solid.box(10.55, 0.1, 0.22, 0, 1.76, -4.15, "#eff0df");
    solid.box(0.22, 0.1, 8.6, -5.18, 1.76, 0, "#eff0df");
    solid.box(10.4, 0.16, 0.06, 0, 0.18, -4.03, "#95a58d");
    solid.box(0.06, 0.16, 8.3, -5.07, 0.18, 0, "#95a58d");
    for (const x of [-3.8, -0.7, 3.4]) {
      solid.box(1.6, 0.85, 0.1, x, 1.07, -4.02, "#92aaa1");
      solid.box(1.44, 0.7, 0.08, x, 1.08, -3.96, "#c7dbcf");
      solid.box(0.045, 0.73, 0.05, x, 1.08, -3.9, "#e6e3d0");
      solid.box(1.45, 0.035, 0.05, x, 1.08, -3.9, "#e6e3d0");
      solid.box(1.78, 0.09, 0.36, x, 0.61, -3.97, "#e7e1c8");
    }
    // The blackboard; its chalk changes with the era (setBoard).
    solid.box(2.75, 1.24, 0.11, 0.45, 1.21, -3.82, "#967859");
    solid.box(2.6, 1.08, 0.06, 0.45, 1.22, -3.74, "#415f4b");
    solid.box(2.78, 0.055, 0.18, 0.45, 0.59, -3.72, "#ae8f6d");
    const plant = (x, z, h) => {
      solid.cyl(0.17, 0.12, 0.28, x, 0.2, z, "#b5a086", 7);
      solid.cyl(0.045, 0.06, h * 0.7, x, 0.4 + h * 0.2, z, "#857761", 5);
      solid.ico(h * 0.36, 0, x, 0.4 + h * 0.62, z, "#7d9275", 0.87, 1.13, 0.85);
    };
    plant(-4.3, 3.1, 0.9);
    plant(4.4, -3.4, 0.85);
    plant(-4.25, -3.3, 0.7);
    // Exterior shrubs and small architectural details preserve the diorama silhouette.
    plant(-6.1, 1.5, 1.2);
    plant(3.9, -5.2, 1.5);
    plant(5.9, -2.6, 1.0);
    solid.box(1.25, 0.1, 0.9, 2.7, 0.05, 4.6, "#cec8b4");
    solid.box(1.1, 0.08, 0.45, 2.7, -0.06, 5.1, "#d9d3c1");
    solid.box(0.65, 0.07, 0.4, -3.3, 0.16, -3.35, "#a88765");
    solid.box(0.2, 0.09, 0.23, -3.37, 0.23, -3.35, "#ebe7d5");
    const casters = new THREE.Mesh(solid.build(), this.mat);
    casters.castShadow = casters.receiveShadow = true;
    const floor = new THREE.Mesh(flat.build(), this.mat);
    floor.receiveShadow = true;
    this.fixed.add(casters, floor);
    this.label(this.fixed, "DARTMOUTH · COMPUTATION LAB", 0, 0.23, 4.34, 3.7, 0.26, "#788774", "#f1ecd9");
    this.board = [];
  }

  setBoard(eraId) {
    for (const m of this.board) {
      this.fixed.remove(m);
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
    const [title, formula] = ERA_BOARDS[eraId] || ERA_BOARDS[1];
    this.board = [this.label(this.fixed, title, 0.45, 1.44, -3.7, 2.35, 0.3), this.label(this.fixed, formula, 0.45, 1.05, -3.695, 2.0, 0.28)];
  }

  /** Merged geometry for one module type, in its own local space: { body, led }. */
  buildingGeometry(type) {
    let cached = this.geoCache.get(type);
    if (cached) return cached;
    const g = new PartsBuilder();
    const led = new PartsBuilder();
    const b = (w, h, d, x, y, z, c) => g.box(w, h, d, x, y, z, c);
    if (type === "desk") {
      b(0.93, 0.1, 0.63, 0, 0.66, 0, "#bba07b");
      for (const x of [-0.37, 0.37]) for (const z of [-0.23, 0.23]) b(0.055, 0.61, 0.055, x, 0.32, z, "#b3b6a5");
      b(0.39, 0.3, 0.23, 0.1, 0.88, -0.12, "#dad8bd");
      b(0.3, 0.2, 0.025, 0.1, 0.88, 0.005, "#425e4d");
      b(0.22, 0.1, 0.026, 0.1, 0.91, 0.022, "#88a177");
      b(0.35, 0.035, 0.12, 0.1, 0.73, 0.19, "#e4dfc8");
      b(0.18, 0.018, 0.24, -0.29, 0.727, 0.05, "#f2eadd");
      b(0.33, 0.07, 0.34, 0, 0.35, 0.52, "#7b9382");
      b(0.34, 0.35, 0.07, 0, 0.54, 0.68, "#819781");
      b(0.07, 0.3, 0.07, 0, 0.16, 0.52, "#8b9184");
    } else if (BUILDINGS[type].compute) {
      const later = LATER.has(type);
      // The cabinet shell (instanced in the original, merged here).
      b(0.79, 1.52, 0.74, 0, 0.86, 0, later ? "#677c87" : type === "micro" ? "#aaada4" : "#a3ad99");
      b(0.69, 1.38, 0.024, 0, 0.87, 0.383, later ? "#344e60" : "#7c8877");
      b(0.82, 0.1, 0.78, 0, 1.63, 0, later ? "#97adb4" : "#cbd0bb");
      b(0.83, 0.09, 0.8, 0, 0.13, 0, "#77816f");
      if (type === "vacuum" || type === "mainframe") {
        for (const x of [-0.18, 0.18]) {
          g.cyl(0.15, 0.15, 0.04, x, 1.3, 0.42, "#e5debd", 10, Math.PI / 2);
          g.cyl(0.06, 0.06, 0.045, x, 1.3, 0.45, "#89957f", 8, Math.PI / 2);
        }
        b(0.47, 0.2, 0.025, 0, 0.89, 0.408, "#c2c7ac");
        b(0.37, 0.1, 0.028, 0, 0.9, 0.429, "#5e795e");
      }
      for (let j = 0; j < (later ? 7 : 4); j++) {
        b(0.57, 0.095, 0.025, 0, 0.43 + j * 0.135, 0.411, later ? "#5b737e" : "#aeb69e");
        led.box(0.045, 0.035, 0.03, 0.19, 0.43 + j * 0.135, 0.434, later ? "#9bced0" : "#d6dd9d");
      }
      // Accelerator trays on the newer clusters.
      if (later) for (let j = 0; j < 6; j++) b(0.47, 0.045, 0.07, 0, 0.49 + j * 0.15, 0.44, "#9ab7bd");
    } else if (type === "power") {
      b(0.76, 0.8, 0.7, 0, 0.5, 0, "#b4b7a3");
      b(0.68, 0.06, 0.74, 0, 0.93, 0, "#d1cbb5");
      b(0.53, 0.47, 0.026, 0, 0.56, 0.37, "#8e9884");
      b(0.12, 0.2, 0.03, -0.13, 0.55, 0.4, "#c99c5b");
      b(0.14, 0.14, 0.04, 0.15, 0.68, 0.4, "#ddd9ba");
    } else if (type === "cooling") {
      b(0.86, 0.76, 0.81, 0, 0.5, 0, "#a9bfc0");
      b(0.8, 0.1, 0.74, 0, 0.92, 0, "#d0d9ce");
      g.cyl(0.25, 0.25, 0.035, 0, 0.99, 0, "#64848b", 12);
      g.cyl(0.08, 0.08, 0.05, 0, 1.02, 0, "#c5d6d0", 8);
      for (let j = 0; j < 5; j++) b(0.63, 0.04, 0.03, 0, 0.3 + j * 0.105, 0.427, "#6e8e94");
    } else if (type === "network") {
      b(0.65, 0.88, 0.58, 0, 0.58, 0, "#acae94");
      b(0.69, 0.08, 0.61, 0, 1.07, 0, "#d0ccb5");
      for (let j = 0; j < 5; j++) {
        b(0.5, 0.075, 0.025, 0, 0.35 + j * 0.13, 0.309, "#677e67");
        for (let i = 0; i < 3; i++) b(0.042, 0.03, 0.025, -0.15 + i * 0.14, 0.35 + j * 0.13, 0.332, "#d0d89e");
      }
    } else if (type === "archive") {
      b(0.82, 1.15, 0.6, 0, 0.7, 0, "#b0a18a");
      b(0.85, 0.07, 0.64, 0, 1.3, 0, "#d2c3a7");
      for (let j = 0; j < 3; j++) {
        b(0.7, 0.29, 0.025, 0, 0.34 + j * 0.34, 0.318, "#cdc3a8");
        b(0.22, 0.025, 0.05, 0, 0.38 + j * 0.34, 0.348, "#8c9580");
      }
      b(0.37, 0.1, 0.27, -0.08, 1.38, 0, "#bd9270");
      b(0.29, 0.06, 0.25, -0.05, 1.46, 0, "#e1d9be");
    } else if (type === "lounge") {
      b(0.87, 0.23, 0.63, 0, 0.35, 0, "#a7b5a2");
      b(0.92, 0.4, 0.19, 0, 0.61, -0.28, "#91a58e");
      for (const x of [-0.39, 0.39]) b(0.15, 0.31, 0.68, x, 0.5, 0, "#94a990");
      b(0.29, 0.08, 0.29, 0, 0.5, 0.66, "#bca281");
      g.cyl(0.04, 0.035, 0.28, 0, 0.33, 0.66, "#8c8671");
    }
    cached = { body: g.build(), led: led.empty ? null : led.build() };
    this.geoCache.set(type, cached);
    return cached;
  }

  personGeometry(color) {
    const key = "person:" + color;
    let geo = this.geoCache.get(key);
    if (geo) return geo;
    const p = new PartsBuilder();
    p.box(0.25, 0.33, 0.17, 0, 0.43, 0, color);
    p.cyl(0.1, 0.085, 0.2, 0, 0.7, 0, "#c9aa87", 7);
    p.cyl(0.106, 0.1, 0.07, 0, 0.82, 0, "#665a4b", 7);
    for (const x of [-0.075, 0.075]) p.box(0.08, 0.23, 0.09, x, 0.16, 0, "#646e68");
    for (const x of [-0.17, 0.17]) p.box(0.075, 0.25, 0.075, x, 0.46, 0, color);
    geo = p.build();
    this.geoCache.set(key, geo);
    return geo;
  }

  rebuild(s) {
    const previous = this.known;
    this.objects.clear();
    this.buildings.clear();
    for (const b of s.labLayout) {
      const { body, led } = this.buildingGeometry(b.type);
      const mesh = new THREE.Mesh(body, this.mat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(tileX(b.x), 0.06, tileZ(b.z));
      mesh.rotation.y = (b.rotation * Math.PI) / 2;
      mesh.userData.buildingId = b.id;
      if (b.type === "power") {
        const sign = new THREE.Mesh(this.boltGeo, this.boltMat);
        sign.position.set(0, 0.5, 0.403);
        mesh.add(sign);
      }
      let ledMesh = null;
      if (led) {
        ledMesh = new THREE.Mesh(led, this.mat);
        mesh.add(ledMesh);
      }
      const entry = { mesh, led: ledMesh, b, pop: previous && !previous.has(b.id) ? 0 : 1 };
      if (entry.pop < 1) mesh.scale.setScalar(0.01);
      this.objects.add(mesh);
      this.buildings.set(b.id, entry);
    }
    this.known = new Set(s.labLayout.map((b) => b.id));

    // Utility conduits: one merged mesh, shown while a connection layer is being edited.
    const conduits = new PartsBuilder();
    for (const [layer, positions] of Object.entries(s.conduits)) {
      const set = new Set(positions),
        offset = layer === "power" ? -0.13 : layer === "cooling" ? 0 : 0.13,
        color = CONDUITS[layer].color;
      for (const p of positions) {
        const [x, z] = p.split(",").map(Number);
        conduits.box(0.12, 0.027, 0.12, tileX(x) + offset, 0.13, tileZ(z) + offset, color);
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
        ])
          if (set.has(`${x + dx},${z + dz}`))
            conduits.box(dx ? 0.98 : 0.043, 0.023, dz ? 0.98 : 0.043, tileX(x) + dx * 0.5 + offset, 0.13, tileZ(z) + dz * 0.5 + offset, color);
      }
    }
    if (this.serviceMesh) {
      this.services.remove(this.serviceMesh);
      this.serviceMesh.geometry.dispose();
      this.serviceMesh = null;
    }
    if (!conduits.empty) {
      this.serviceMesh = new THREE.Mesh(conduits.build(), this.mat);
      this.serviceMesh.receiveShadow = true;
      this.services.add(this.serviceMesh);
    }

    this.people.clear();
    this.agents = s.talent.map((t, i) => {
      const person = new THREE.Mesh(this.personGeometry(t.color), this.mat);
      person.castShadow = true;
      person.userData.offset = i * 3.8;
      this.people.add(person);
      return person;
    });
  }

  sync(s, d) {
    const eraId = eraIdFor(s.year);
    if (eraId !== this.eraId) {
      this.eraId = eraId;
      this.setBoard(eraId);
    }
    if (this.revision !== s.revision) {
      this.revision = s.revision;
      this.rebuild(s);
    }
    this.s = s;
    this.d = d;
    // Machine status lights: dark without power, amber when overheating.
    for (const { led, b } of this.buildings.values()) {
      if (!led) continue;
      const status = d.statuses[b.id];
      led.material = !status ? this.mat : !status.power ? this.offMat : status.temperature > 55 ? this.hotMat : this.mat;
    }
    this.refreshPointer();
  }

  /** A different lab was loaded: rebuild everything on the next sync, without placement animations. */
  invalidate() {
    this.revision = -1;
    this.known = null;
    this.selectedId = null;
    this.hover = null;
  }

  setMode(type, layer = null, rotation = 0) {
    this.buildType = type;
    this.layer = layer;
    this.rotation = rotation;
    this.services.visible = !!layer;
    this.refreshPointer();
  }

  setSelected(id) {
    this.selectedId = id ?? null;
  }

  /** The floor tile under normalized device coordinates, or null. */
  pick(nx, ny) {
    this.ndc.set(nx, ny);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(this.ndc, this.camera);
    if (!this.ray.ray.intersectPlane(this.groundPlane, this.point)) return null;
    const x = Math.floor(this.point.x + 5),
      z = Math.floor(this.point.z + 4);
    if (x < 0 || x >= GRID.w || z < 0 || z >= GRID.h) return null;
    return { x, z };
  }

  setHover(cell) {
    const same = cell && this.hover && cell.x === this.hover.x && cell.z === this.hover.z;
    if (same || (!cell && !this.hover)) return;
    this.hover = cell ? { x: cell.x, z: cell.z } : null;
    this.refreshPointer();
  }

  refreshPointer() {
    const cell = this.hover;
    if (!cell) {
      this.cursor.visible = false;
      this.ghost.visible = false;
      return;
    }
    const occupied = !!this.s?.labLayout.some((b) => b.x === cell.x && b.z === cell.z);
    const building = this.buildType && BUILDINGS[this.buildType];
    this.cursor.position.set(tileX(cell.x), 0.16, tileZ(cell.z));
    this.cursorMat.color.set(occupied && this.buildType && this.buildType !== "demolish" ? "#c68167" : this.buildType === "demolish" && occupied ? "#c9a06a" : "#88a585");
    this.cursor.visible = true;
    if (building) {
      this.ghost.geometry = this.buildingGeometry(this.buildType).body;
      this.ghost.material = occupied ? this.ghostBadMat : this.ghostMat;
      this.ghost.position.set(tileX(cell.x), 0.07, tileZ(cell.z));
      this.ghost.rotation.y = (this.rotation * Math.PI) / 2;
      this.ghost.visible = true;
    } else this.ghost.visible = false;
  }

  /* ---- camera: a damped orbit around the room, like the original orbit controls */
  orbit(dYaw, dPolar) {
    this.goal.yaw -= dYaw;
    this.goal.polar = clamp(this.goal.polar - dPolar, LIMITS.minPolar, LIMITS.maxPolar);
  }
  /** Drag the room with the pointer: dx, dy in CSS pixels. */
  panPixels(dx, dy) {
    const h = Math.max(1, this.kit.size.height);
    const perPixel = (2 * this.view.dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / h;
    const yaw = this.view.yaw;
    const along = dy * perPixel / Math.max(0.35, Math.cos(this.view.polar));
    this.panWorld(-Math.cos(yaw) * dx * perPixel - Math.sin(yaw) * along, Math.sin(yaw) * dx * perPixel - Math.cos(yaw) * along);
  }
  panWorld(dx, dz) {
    let x = this.goal.x + dx,
      z = this.goal.z + dz;
    const r = Math.hypot(x, z);
    if (r > LIMITS.radius) {
      x *= LIMITS.radius / r;
      z *= LIMITS.radius / r;
    }
    this.goal.x = x;
    this.goal.z = z;
  }
  /** Ease the orbit centre toward a tile (gamepad and keyboard cursor). */
  follow(cell, amount) {
    if (!cell) return;
    const tx = tileX(cell.x) * 0.6,
      tz = tileZ(cell.z) * 0.6;
    this.panWorld((tx - this.goal.x) * amount, (tz - this.goal.z) * amount);
  }
  zoom(factor) {
    this.goal.dist = clamp(this.goal.dist * factor, LIMITS.minDist, LIMITS.maxDist);
  }
  reset() {
    Object.assign(this.goal, HOME);
  }
  updateCamera(dt) {
    const k = 1 - Math.exp(-12 * dt);
    const v = this.view,
      g = this.goal;
    v.yaw += (g.yaw - v.yaw) * k;
    v.polar += (g.polar - v.polar) * k;
    v.dist += (g.dist - v.dist) * k;
    v.x += (g.x - v.x) * k;
    v.z += (g.z - v.z) * k;
    const sp = Math.sin(v.polar);
    this.lookTarget.set(v.x, TARGET_Y, v.z);
    this.camera.position.set(v.x + v.dist * sp * Math.sin(v.yaw), TARGET_Y + v.dist * Math.cos(v.polar), v.z + v.dist * sp * Math.cos(v.yaw));
    this.camera.lookAt(this.lookTarget);
  }

  render(t, dt) {
    const moving = this.s && !this.s.paused && !this.s.event && !this.s.gameOver && !this.s.completed;
    if (moving) this.agentClock += dt * 0.15;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i],
        phase = this.agentClock + i * 0.9;
      a.position.set(Math.sin(phase) * 2.5, Math.sin(phase * 16) * 0.012, Math.cos(phase * 0.7 + i) * 1.1 + 1.25);
      a.rotation.y = Math.cos(phase) * 0.6 + Math.PI / 2;
    }
    // New modules settle into place with a little overshoot.
    for (const entry of this.buildings.values()) {
      if (entry.pop >= 1) continue;
      entry.pop = Math.min(1, entry.pop + dt / 0.38);
      const p = entry.pop,
        c = 1.70158;
      const s = 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
      entry.mesh.scale.set(Math.max(0.01, s), Math.max(0.01, 0.4 + 0.6 * s), Math.max(0.01, s));
    }
    const sel = this.selectedId != null ? this.buildings.get(this.selectedId) : null;
    this.selection.visible = !!sel;
    if (sel) {
      this.selection.position.set(sel.mesh.position.x, 0.13 + Math.sin(t * 3.2) * 0.012, sel.mesh.position.z);
      const s = 1.02 + Math.sin(t * 3.2) * 0.02;
      this.selection.scale.set(s, 1, s);
    }
    this.updateCamera(dt);
    const { width, height } = this.kit.size;
    const aspect = width / Math.max(1, height);
    if (Math.abs(this.camera.aspect - aspect) > 1e-4) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.kit.renderer.render(this.scene, this.camera);
  }
}
