// Rendering layer: reads sim state, never mutates game rules.
import * as THREE from 'three';
import { createSim, step, snapshot, TICK_RATE } from '../core/sim.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.Fog(0x0b0f1a, 10, 40);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);

scene.add(new THREE.HemisphereLight(0x8899ff, 0x221100, 0.6));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x1d2b22 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const player = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0x332200 }));
const lamp = new THREE.PointLight(0xffc060, 3, 8);
player.add(lamp);
scene.add(player);

const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const sim = createSim({ seed: 1 });
const hud = document.getElementById('hud');
const dt = 1000 / TICK_RATE;
let acc = 0, last = performance.now();

function input() {
  return {
    moveX: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
    moveZ: (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0),
  };
}

renderer.setAnimationLoop((now) => {
  acc += Math.min(now - last, 250);
  last = now;
  while (acc >= dt) { step(sim, input()); acc -= dt; } // fixed timestep, same as headless
  const p = sim.player;
  player.position.set(p.x, 0.8, p.z);
  camera.position.set(p.x, 5, p.z + 8);
  camera.lookAt(p.x, 0.8, p.z);
  hud.textContent = `WASD để di chuyển · ${JSON.stringify(snapshot(sim))}`;
  renderer.render(scene, camera);
});
