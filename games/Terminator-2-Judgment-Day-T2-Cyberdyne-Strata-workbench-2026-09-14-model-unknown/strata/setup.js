/*
 * Runs before any other game module. The original renderer lit gamma-space colours by hand and
 * wrote straight to the canvas, so the page keeps three.js colour management off and outputs
 * linear: every colour below reaches the screen exactly as authored.
 */
import * as THREE from 'three/webgpu';
THREE.ColorManagement.enabled = false;
