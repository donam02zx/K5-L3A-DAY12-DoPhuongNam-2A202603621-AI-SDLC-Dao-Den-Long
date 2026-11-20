// Rendering layer: reads sim state, never owns game rules.
// Input is converted to the same held-state format the headless runner uses.
import * as THREE from 'three';
import { createSim, step, TICK_RATE } from '../core/sim.js';
import { TUNING as T, WORLD } from '../core/tuning.js';

const WARM = 0xffb347, INK = 0x2a0f3d;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const DARK_SKY = new THREE.Color(0x120a1f), LIT_SKY = new THREE.Color(0x3b2a4a);
scene.background = DARK_SKY.clone();
scene.fog = new THREE.Fog(DARK_SKY.clone(), 12, 55);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);

const hemi = new THREE.HemisphereLight(0x6a5acd, 0x1a0f10, 0.6);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8899cc, 0.25);
moon.position.set(-20, 30, 10);
scene.add(moon);

// island + cloud sea
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 3, 3, 64),
  new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 1 }),
);
island.position.y = -1.5;
scene.add(island);
const sea = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshStandardMaterial({ color: 0x3d3357, roughness: 1 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -4;
scene.add(sea);
// a few static rocks/bushes for scale (fixed layout, purely visual)
for (let i = 0; i < 24; i++) {
  const a = i * 2.39996, r = 8 + ((i * 7) % 29);
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + (i % 3) * 0.3, 0), new THREE.MeshStandardMaterial({ color: 0x24402a, flatShading: true }));
  bush.position.set(r * Math.cos(a), 0.3, r * Math.sin(a));
  scene.add(bush);
}

// ---------- Mây: nón lá + small lantern ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 12), new THREE.MeshStandardMaterial({ color: 0x5b7fb8 }));
  body.position.y = 0.65;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf1d2b3 }));
  head.position.y = 1.35;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24), new THREE.MeshStandardMaterial({ color: 0xe8cf8a, flatShading: true }));
  hat.position.y = 1.65;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35), new THREE.MeshBasicMaterial({ color: 0x553311 }));
  string.position.set(0.6, 1.3, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: WARM, emissive: WARM, emissiveIntensity: 2 }));
  lamp.position.set(0.6, 1.08, 0);
  const light = new THREE.PointLight(WARM, 6, 9, 1.5);
  light.position.copy(lamp.position);
  g.add(body, head, hat, string, lamp, light);
  g.userData = { light, lamp };
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- entity pools keyed by id ----------
const lanternMeshes = new Map(), moteMeshes = new Map(), shadeMeshes = new Map();

function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3), new THREE.MeshStandardMaterial({ color: 0x4a3322 }));
  post.position.y = 1.5;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x7a2e1e }));
  roof.position.y = 3.95;
  roof.rotation.y = Math.PI / 4;
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x55405a, emissive: WARM, emissiveIntensity: 0 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), glassMat);
  glass.position.y = 3.3;
  const light = new THREE.PointLight(WARM, 0, 18, 1.2);
  light.position.y = 3.3;
  const ringMat = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(post, roof, glass, light, ring);
  g.userData = { glassMat, light, ringMat };
  return g;
}
const moteGeo = new THREE.SphereGeometry(0.15, 8, 6);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffd34d, emissiveIntensity: 3 });
const shadeGeo = new THREE.IcosahedronGeometry(0.9, 1);

function makeShade() {
  const mat = new THREE.MeshStandardMaterial({ color: INK, emissive: 0x3a1060, emissiveIntensity: 0.6, flatShading: true, transparent: true, opacity: 0.92 });
  const m = new THREE.Mesh(shadeGeo, mat);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc58bff });
  for (const x of [-0.3, 0.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
    eye.position.set(x, 0.2, 0.8);
    m.add(eye);
  }
  m.userData = { mat };
  return m;
}

function sync(pool, list, make, apply) {
  const seen = new Set();
  for (const item of list) {
    let m = pool.get(item.id);
    if (!m) { m = make(); pool.set(item.id, m); scene.add(m); }
    apply(m, item);
    seen.add(item.id);
  }
  for (const [id, m] of pool) if (!seen.has(id)) { scene.remove(m); pool.delete(id); }
}

// pulse wave effect
const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, side: THREE.DoubleSide }));
wave.rotation.x = -Math.PI / 2;
scene.add(wave);
let waveT = 1;

// ---------- input ----------
const keys = new Set();
let yaw = 0, dragging = false, lastX = 0;
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR' && sim.state !== 'playing') restart(); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', (e) => { if (e.button === 2) { dragging = true; lastX = e.clientX; } else keys.add('Mouse0'); });
addEventListener('pointerup', (e) => { if (e.button === 2) dragging = false; else keys.delete('Mouse0'); });
addEventListener('pointermove', (e) => { if (dragging) { yaw -= (e.clientX - lastX) * 0.3; lastX = e.clientX; } });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function readInput() {
  const k = (c) => keys.has(c);
  // Camera looks along f=(sin yaw, cos yaw); screen-right is (-cos yaw, sin yaw) => move x = -1.
  return {
    move: [(k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0), (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0)],
    cam_yaw_deg: yaw,
    jump: k('Space'),
    interact: k('KeyE'),
    pulse: k('KeyF') || k('Mouse0'),
  };
}

// ---------- HUD ----------
const hud = document.getElementById('hud');
const overlay = document.getElementById('overlay');
const toast = document.getElementById('toast');
let toastT = 0;
const say = (msg) => { toast.textContent = msg; toast.style.opacity = 1; toastT = 2; };
const REASON = { all_lit: 'Mọi Đèn Lồng Lớn đã sáng!', dawn: 'Trời đã sáng mà đảo vẫn chưa sáng đèn…', no_flames: 'Ngọn lửa của Mây đã tắt…' };

function drawHud() {
  const p = sim.player;
  const litCount = sim.lanterns.filter((L) => L.lit).length;
  const t = Math.ceil(sim.timeLeftTicks / TICK_RATE);
  const cd = p.pulseCd > 0 ? `${(p.pulseCd / TICK_RATE).toFixed(1)}s` : p.carried >= T.pulse_cost ? 'sẵn sàng' : 'thiếu sáng';
  hud.innerHTML =
    `<b>Đêm 1 – Đảo Bến</b><br>` +
    `Lửa: ${'🔥'.repeat(p.flames)}${'·'.repeat(Math.max(0, T.flames - p.flames))}<br>` +
    `Đom đóm: ${p.carried}/${T.carry_capacity}<br>` +
    `Đèn: ${litCount}/${sim.lanterns.length}<br>` +
    `Bình minh sau: ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}<br>` +
    `Điểm: ${sim.score}<br>Tỏa sáng: ${cd}`;
}

// ---------- game loop ----------
let sim;
// Debug/screenshot helpers: ?seed=N fixes the seed, ?lit=N pre-lights the last N lanterns.
const params = new URLSearchParams(location.search);
function restart() {
  const lit = Math.min(+(params.get('lit') ?? 0), T.lantern_count_night1);
  const scenario = lit ? { lanterns: Array.from({ length: lit }, (_, i) => ({ id: `L${T.lantern_count_night1 - i}`, lit: true })) } : null;
  sim = createSim({ seed: params.has('seed') ? +params.get('seed') : (Math.random() * 2 ** 31) >>> 0, scenario });
  overlay.style.display = 'none';
  say('Gom đom đóm, mang về thắp Đèn Lồng Lớn!');
}
restart();

const dt = 1000 / TICK_RATE;
let acc = 0, last = performance.now();

function handle(e) {
  if (e.name === 'lantern_lit') say(`Đèn ${e.data.lantern_id} đã sáng!`);
  else if (e.name === 'player_hit') say(`Bị Bóng Mực chạm! Rơi ${e.data.dropped} đom đóm`);
  else if (e.name === 'pulse') { waveT = 0; wave.position.set(sim.player.pos[0], 0.1, sim.player.pos[2]); }
  else if (e.name === 'shade_spawned') say('Một Bóng Mực mới trồi lên từ sương…');
  else if (e.name === 'game_over') {
    overlay.innerHTML = `<h1>${e.data.result === 'won' ? 'Thắng!' : 'Thua'}</h1><p>${REASON[e.data.reason]}</p><p>Điểm: <b>${sim.score}</b></p><p>Nhấn <b>R</b> để chơi lại</p>`;
    overlay.style.display = 'flex';
  }
}

renderer.setAnimationLoop((now) => {
  const frame = Math.min(now - last, 250);
  last = now;
  acc += frame;
  if (keys.has('ArrowLeft')) yaw += (90 * frame) / 1000;
  if (keys.has('ArrowRight')) yaw -= (90 * frame) / 1000;
  while (acc >= dt) { step(sim, readInput()).forEach(handle); acc -= dt; }

  const time = now / 1000;
  const p = sim.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const mv = readInput().move;
  if (mv[0] || mv[1]) {
    const th = (yaw * Math.PI) / 180;
    const wx = mv[0] * Math.cos(th) + mv[1] * Math.sin(th), wz = -mv[0] * Math.sin(th) + mv[1] * Math.cos(th);
    may.rotation.y = Math.atan2(wx, wz);
  }
  may.visible = !(p.invuln > 0 && Math.floor(time * 12) % 2);
  may.userData.light.intensity = 3 + p.carried * 1.2;

  const litCount = sim.lanterns.filter((L) => L.lit).length;
  const k = litCount / sim.lanterns.length;
  scene.background.copy(DARK_SKY).lerp(LIT_SKY, k);
  scene.fog.color.copy(scene.background);
  scene.fog.far = 55 + 60 * k;
  hemi.intensity = 0.6 + 1.2 * k;

  sync(lanternMeshes, sim.lanterns, makeLantern, (m, L) => {
    m.position.set(...L.pos);
    const fill = L.lit ? 1 : L.deposited / T.lantern_cost;
    m.userData.glassMat.emissiveIntensity = L.lit ? 2.5 : 0.15 + fill * 0.8;
    m.userData.light.intensity = L.lit ? 30 : fill * 4;
    m.userData.ringMat.opacity = L.lit ? 0.35 : 0;
  });
  sync(moteMeshes, sim.motes, () => new THREE.Mesh(moteGeo, moteMat), (m, mo) => {
    const ph = mo.pos[0] * 1.7 + mo.pos[2];
    m.position.set(mo.pos[0], 0.8 + Math.sin(time * 2 + ph) * 0.2, mo.pos[2]);
  });
  sync(shadeMeshes, sim.shades, makeShade, (m, sh) => {
    m.position.set(sh.pos[0], 1 + Math.sin(time * 3 + sh.pos[0]) * 0.15, sh.pos[2]);
    m.lookAt(p.pos[0], 1, p.pos[2]);
    m.userData.mat.opacity = sh.stun > 0 ? 0.35 : 0.92;
    m.scale.setScalar(sh.stun > 0 ? 0.8 : 1 + Math.sin(time * 5) * 0.05);
  });

  if (waveT < 1) {
    waveT += frame / 400;
    wave.scale.setScalar(Math.max(0.01, waveT * T.pulse_radius));
    wave.material.opacity = 1 - waveT;
  }

  const th = (yaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 6, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  if (toastT > 0 && (toastT -= frame / 1000) <= 0) toast.style.opacity = 0;
  drawHud();
  renderer.render(scene, camera);
});

window.__sim = () => sim; // debug hook for manual checks
