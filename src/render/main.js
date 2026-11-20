// Rendering + UI layer. Reads sim state, never owns game rules.
// Input is converted to the same held-state format the headless runner uses.
import * as THREE from 'three';
import { createSim, step, TICK_RATE, windWarning } from '../core/sim.js';
import { TUNING as T } from '../core/tuning.js';
import { NIGHTS } from '../core/maps.js';
import { PAL, buildWorld, makePad } from './world.js';
import { sfx, setVolume, unlock, startMusic } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ---------- settings (persisted) ----------
const settings = { volume: 0.6, sens: 0.3 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') ?? '{}')); } catch { /* storage unavailable */ }
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } };
setVolume(settings.volume);
$('set-volume').value = settings.volume;
$('set-sens').value = settings.sens;
$('set-volume').oninput = (e) => { settings.volume = +e.target.value; setVolume(settings.volume); saveSettings(); sfx.pick(); };
$('set-sens').oninput = (e) => { settings.sens = +e.target.value; saveSettings(); };

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.Fog(PAL.fog, 18, 70);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
const ambient = new THREE.AmbientLight(0x8a90c0, 0.15);
const moon = new THREE.DirectionalLight(0x9aa8d8, 0.25);
moon.position.set(-30, 40, 10);
scene.add(ambient, moon);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- Mây ----------
function makeMay() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: PAL.shirt });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.55, 4, 12), shirt);
  body.position.y = 0.62;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 8, 16), new THREE.MeshStandardMaterial({ color: PAL.scarf }));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf1d2b3 }));
  head.position.y = 1.32;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.42, 24), new THREE.MeshStandardMaterial({ color: PAL.sand, flatShading: true }));
  hat.position.y = 1.62;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: PAL.lampOn, emissive: PAL.lampOn, emissiveIntensity: 2 }));
  lamp.position.set(0.58, 1.12, 0);
  const light = new THREE.PointLight(PAL.lampOn, 6, 10, 1.5);
  light.position.copy(lamp.position);
  g.add(body, scarf, head, hat, lamp, light);
  g.userData.light = light;
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- dynamic entity pools ----------
const pools = { lanterns: new Map(), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
let worldGroup = null;
const moteGeo = new THREE.SphereGeometry(0.14, 8, 6);
const moteMat = new THREE.MeshStandardMaterial({ color: PAL.moteCore, emissive: PAL.moteGlow, emissiveIntensity: 3 });
const droppedMat = new THREE.MeshStandardMaterial({ color: PAL.moteCore, emissive: PAL.moteGlow, emissiveIntensity: 1.5, transparent: true, opacity: 0.8 });
const shadeGeo = new THREE.IcosahedronGeometry(0.85, 1);

function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3), new THREE.MeshStandardMaterial({ color: PAL.wood }));
  post.position.y = 1.5;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x7a2e1e }));
  roof.position.y = 3.95; roof.rotation.y = Math.PI / 4;
  const glassMat = new THREE.MeshStandardMaterial({ color: PAL.lampOff, emissive: PAL.lampOn, emissiveIntensity: 0 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), glassMat);
  glass.position.y = 3.3;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: PAL.lampCore }));
  core.position.y = 3.3;
  const light = new THREE.PointLight(PAL.lampOn, 0, 20, 1.2);
  light.position.y = 3.3;
  const ringMat = new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
  g.add(post, roof, glass, core, light, ring);
  g.userData = { glassMat, light, ringMat, core };
  return g;
}
function makeShade() {
  const m = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: PAL.shade, emissive: PAL.shadeRim, emissiveIntensity: 0.35, flatShading: true }));
  const rim = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({ color: PAL.shadeRim, wireframe: true, transparent: true, opacity: 0.5 }));
  rim.scale.setScalar(1.05);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc58bff });
  for (const x of [-0.28, 0.28]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat); e.position.set(x, 0.2, 0.78); m.add(e); }
  m.add(rim);
  m.userData.rim = rim;
  return m;
}
function makeDrifter() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.35, 12, 1), new THREE.MeshStandardMaterial({ color: PAL.drifter, emissive: PAL.drifter, emissiveIntensity: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  m.userData.base = m.geometry.attributes.position.array.slice();
  return m;
}
function makeCharm() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), new THREE.MeshStandardMaterial({ color: PAL.scarf, emissive: PAL.scarf, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  const border = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshBasicMaterial({ color: PAL.gold, side: THREE.DoubleSide }));
  border.position.z = -0.01;
  g.add(border, paper);
  return g;
}
function sync(pool, list, make, apply) {
  const seen = new Set();
  for (const item of list) {
    let m = pool.get(item.id);
    if (!m) { m = make(item); pool.set(item.id, m); scene.add(m); }
    apply(m, item);
    seen.add(item.id);
  }
  for (const [id, m] of pool) if (!seen.has(id)) { scene.remove(m); pool.delete(id); }
}
function clearPools() { for (const pool of Object.values(pools)) { for (const m of pool.values()) scene.remove(m); pool.clear(); } }

const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0, side: THREE.DoubleSide }));
wave.rotation.x = -Math.PI / 2;
scene.add(wave);
let waveT = 1;
const leaves = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(300), 3)),
  new THREE.PointsMaterial({ color: 0x7fbf7f, size: 0.25 }));
scene.add(leaves);

// ---------- game flow ----------
const QUOTES = {
  1: 'Ông Đăng: “Đảo Bến là nơi ta bắt đầu, cháu ạ. Năm chiếc đèn quanh bến cần ánh sáng của cháu.”',
  2: 'Ông Đăng: “Đảo Cau có hai mỏm, nối nhau bằng cây cầu tre. Coi chừng Gió Lạc, chúng thích đom đóm lắm.”',
  3: 'Ông Đăng: “Đảo Chuông cao và lộng gió. Hãy nghe tiếng lá: gió sắp nổi thì đứng cho vững.”',
};
let mode = 'menu', night = 1, sim = null, totalScore = 0, settingsReturn = 'menu';
const show = (id) => { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id); };

function startNight(n) {
  night = n;
  clearPools();
  if (worldGroup) scene.remove(worldGroup);
  worldGroup = buildWorld(n);
  for (const pad of NIGHTS[n].pads) worldGroup.add(makePad(pad.pos));
  scene.add(worldGroup);
  const seed = params.has('seed') ? +params.get('seed') : (Math.random() * 2 ** 31) >>> 0;
  const lit = Math.min(+(params.get('lit') ?? 0), NIGHTS[n].lanterns.length);
  const scenario = lit ? { lanterns: NIGHTS[n].lanterns.slice(-lit).map((l) => ({ id: l.id, lit: true })) } : null;
  sim = createSim({ seed, night: n, scenario });
  yaw = 0;
  $('intro-night').textContent = `Đêm ${n}`;
  $('intro-name').textContent = NIGHTS[n].name;
  $('intro-quote').textContent = QUOTES[n];
  mode = 'intro';
  show('intro');
}
function play() { mode = 'play'; show(null); unlock(); startMusic(); say('Gom đom đóm, mang về thắp Đèn Lồng Lớn!'); }
function pause() { if (mode !== 'play') return; mode = 'paused'; show('pause'); document.exitPointerLock?.(); }
function resume() { mode = 'play'; show(null); }
function endNight(result) {
  mode = 'result';
  document.exitPointerLock?.();
  const won = result.result === 'won';
  if (won) totalScore += sim.score;
  (won ? sfx.win : sfx.lose)();
  if (won && night === 3) { $('dawn-score').textContent = `Tổng điểm: ${totalScore}`; show('dawn'); mode = 'dawn'; return; }
  $('result-title').textContent = won ? 'Đèn đã sáng!' : 'Thua rồi…';
  $('result-text').textContent = (won ? `Điểm đêm này: ${sim.score}. ` : result.reason === 'dawn' ? 'Trời đã sáng mà đảo vẫn còn tối. ' : 'Ngọn lửa của Mây đã tắt. ') + `Tổng điểm: ${totalScore}`;
  $('btn-next').style.display = won ? '' : 'none';
  show('result');
}
document.addEventListener('click', (e) => {
  const act = e.target.closest('button')?.dataset.act;
  if (!act) return;
  unlock();
  if (act === 'start') { totalScore = 0; startNight(+(params.get('night') ?? 1)); }
  else if (act === 'play') play();
  else if (act === 'resume') resume();
  else if (act === 'retry') startNight(night);
  else if (act === 'next') startNight(night + 1);
  else if (act === 'menu') { mode = 'menu'; show('menu'); }
  else if (act === 'settings') { settingsReturn = mode === 'paused' ? 'pause' : 'menu'; show('settings'); }
  else if (act === 'back') show(settingsReturn);
});

// ---------- input ----------
const keys = new Set();
let yaw = 0;
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') pause(); else if (mode === 'paused') resume(); return; }
  keys.add(e.code);
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ShiftLeft'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); pause(); });
renderer.domElement.addEventListener('mousedown', (e) => {
  if (mode !== 'play') return;
  if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
  else if (e.button === 0) keys.add('Mouse0');
});
addEventListener('mouseup', (e) => { if (e.button === 0) keys.delete('Mouse0'); });
addEventListener('mousemove', (e) => { if (document.pointerLockElement === renderer.domElement) yaw -= e.movementX * settings.sens; });

function readInput() {
  const k = (c) => keys.has(c);
  // camera looks along f=(sin yaw, cos yaw); screen-right is (-cos yaw, sin yaw) => move x = -1
  return {
    move: [(k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0), (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0)],
    cam_yaw_deg: yaw, jump: k('Space'), interact: k('KeyE'), pulse: k('KeyF') || k('Mouse0'), dash: k('ShiftLeft') || k('ShiftRight'),
  };
}

// ---------- HUD ----------
let toastT = 0, lastCountdown = -1;
const say = (msg) => { $('toast').textContent = msg; $('toast').style.opacity = 1; toastT = 2.2; };
$('bar').innerHTML = '<i></i>'.repeat(T.carry_capacity);
const barCells = [...$('bar').children];
const v3 = new THREE.Vector3();

function drawHud() {
  const p = sim.player;
  const litN = sim.lanterns.filter((L) => L.lit).length;
  $('flames').textContent = '🔥'.repeat(p.flames) + '·'.repeat(Math.max(0, T.flames - p.flames));
  const secs = Math.ceil(sim.timeLeftTicks / TICK_RATE);
  $('clock').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('danger', secs <= 30);
  if (secs <= 10 && secs !== lastCountdown && mode === 'play') { lastCountdown = secs; sfx.tick(); }
  $('topright').innerHTML = `Đèn <b>${litN}/${sim.lanterns.length}</b><br>Điểm <b>${totalScore + sim.score}</b>`;
  barCells.forEach((c, i) => c.classList.toggle('on', i < p.carried));
  const cd = (id, left, total, ready) => {
    $(id).querySelector('.fill').style.height = `${(left / total) * 100}%`;
    $(id).classList.toggle('off', !ready);
  };
  cd('cd-dash', p.charm > 0 ? 0 : p.dashCd, T.dash_cooldown_s * TICK_RATE, p.dashCd === 0 || p.charm > 0);
  cd('cd-pulse', p.pulseCd, T.pulse_cooldown_s * TICK_RATE, p.pulseCd === 0 && p.carried >= T.pulse_cost);
  $('charm').style.display = p.charm > 0 ? 'block' : 'none';
  $('charm').textContent = `Bùa Gió ${(p.charm / TICK_RATE).toFixed(1)}s`;
  $('wind').style.display = windWarning(sim) || sim.wind.active ? 'block' : 'none';
  $('wind').textContent = sim.wind.active ? '🍃 Gió mạnh!' : '🍃 Gió sắp nổi…';
  // prompt near an unlit lantern
  const near = sim.lanterns.find((L) => !L.lit && Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= T.interact_radius);
  $('prompt').style.display = near ? 'block' : 'none';
  if (near) $('prompt').textContent = `E — Nạp ánh sáng (${near.deposited}/${T.lantern_cost})`;
  // arrow to nearest unlit lantern when off-screen
  const target = sim.lanterns.filter((L) => !L.lit).sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  const arrow = $('arrow');
  if (!target) { arrow.style.display = 'none'; return; }
  v3.set(target.pos[0], target.pos[1] + 3, target.pos[2]).project(camera);
  const behind = v3.z > 1;
  const onScreen = !behind && Math.abs(v3.x) < 0.95 && Math.abs(v3.y) < 0.95;
  arrow.style.display = onScreen ? 'none' : 'block';
  if (!onScreen) {
    let x = v3.x, y = v3.y;
    if (behind) { x = -x; y = -y; }
    const a = Math.atan2(y, x), r = 0.85;
    const sx = (0.5 + (Math.cos(a) * r) / 2) * innerWidth, sy = (0.5 - (Math.sin(a) * r) / 2) * innerHeight;
    arrow.style.left = `${sx - 14}px`; arrow.style.top = `${sy - 14}px`;
    arrow.style.transform = `rotate(${Math.PI / 2 - a}rad)`;
  }
}

function handle(e) {
  const p = sim.player;
  switch (e.name) {
    case 'mote_picked': sfx.pick(); break;
    case 'deposit': sfx.deposit(); break;
    case 'lantern_lit': sfx.lit(); say(`Đèn ${e.data.lantern_id} đã sáng!`); break;
    case 'pulse': sfx.pulse(); waveT = 0; wave.position.set(p.pos[0], p.pos[1] + 0.1, p.pos[2]); break;
    case 'player_hit': (e.data.by === 'fall' ? sfx.fall : sfx.hit)(); say(e.data.by === 'fall' ? 'Mây rơi xuống biển mây!' : `Bị Bóng Mực chạm! Rơi ${e.data.dropped} đom đóm`); break;
    case 'shade_spawned': sfx.shade(); break;
    case 'dash': sfx.dash(); break;
    case 'charm_picked': sfx.charm(); say('Bùa Gió! Chạy nhanh hơn, lướt không cần hồi chiêu'); break;
    case 'drifter_steal': sfx.steal(); say(`Gió Lạc cướp ${e.data.amount} đom đóm!`); break;
    case 'drifter_drop': sfx.deposit(); say('Gió Lạc đánh rơi đom đóm!'); break;
    case 'game_over': endNight(e.data); break;
  }
}

// ---------- main loop ----------
const dt = 1000 / TICK_RATE;
let acc = 0, last = performance.now(), wasJumping = false, windOn = false;
let fpsFrames = 0, fpsT = 0, fpsVal = 0;
const fpsSamples = [];

renderer.setAnimationLoop((now) => {
  const frame = Math.min(now - last, 250);
  last = now;
  fpsFrames++; fpsT += frame;
  if (fpsT >= 1000) { fpsVal = (fpsFrames * 1000) / fpsT; fpsSamples.push(fpsVal); fpsFrames = 0; fpsT = 0; }
  if (params.has('fps')) $('fps').textContent = `${fpsVal.toFixed(0)} FPS · avg ${(fpsSamples.reduce((a, b) => a + b, 0) / Math.max(1, fpsSamples.length)).toFixed(1)}`;
  if (!sim) { renderer.render(scene, camera); return; }

  if (mode === 'play') {
    acc += frame;
    if (keys.has('ArrowLeft')) yaw += (90 * frame) / 1000;
    if (keys.has('ArrowRight')) yaw -= (90 * frame) / 1000;
    while (acc >= dt && mode === 'play') {
      const inp = readInput();
      if (inp.jump && !wasJumping && sim.player.grounded) sfx.jump();
      wasJumping = inp.jump;
      step(sim, inp).forEach(handle);
      acc -= dt;
    }
  } else acc = 0;

  const time = now / 1000, p = sim.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  if (Math.hypot(p.vel[0], p.vel[2]) > 0.1) may.rotation.y = Math.atan2(p.vel[0], p.vel[2]);
  may.visible = p.fallWait === 0 ? !(p.invuln > 0 && Math.floor(time * 12) % 2) : p.pos[1] > -14;
  may.userData.light.intensity = 3 + p.carried * 0.6;

  const k = sim.lanterns.filter((L) => L.lit).length / sim.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * k;
  scene.fog.far = 70 + 60 * k;

  sync(pools.lanterns, sim.lanterns, makeLantern, (m, L) => {
    m.position.set(...L.pos);
    const fill = L.lit ? 1 : L.deposited / T.lantern_cost;
    m.userData.glassMat.color.setHex(L.lit ? PAL.lampOn : PAL.lampOff);
    m.userData.glassMat.emissiveIntensity = L.lit ? 2.2 : fill * 0.8;
    m.userData.core.visible = L.lit;
    m.userData.light.intensity = L.lit ? 35 : fill * 4;
    m.userData.ringMat.opacity = L.lit ? 0.35 : 0;
  });
  sync(pools.motes, sim.motes, (mo) => new THREE.Mesh(moteGeo, mo.kind === 'dropped' ? droppedMat : moteMat), (m, mo) => {
    const ph = mo.pos[0] * 1.7 + mo.pos[2];
    m.position.set(mo.pos[0], mo.pos[1] + 0.8 + Math.sin(time * 2 + ph) * 0.2, mo.pos[2]);
    if (mo.kind === 'dropped' && mo.ttl < 120) m.visible = Math.floor(time * 8) % 2 === 0;
  });
  sync(pools.shades, sim.shades, makeShade, (m, sh) => {
    const stunned = sh.state === 'stunned', spawning = sh.state === 'spawning';
    m.position.set(sh.pos[0], sh.pos[1] + (spawning ? -0.8 + (1 - sh.ticks / 30) * 1.8 : 1 + Math.sin(time * 3 + sh.pos[0]) * 0.15), sh.pos[2]);
    m.lookAt(p.pos[0], m.position.y, p.pos[2]);
    m.material.color.setHex(stunned ? PAL.shadeStun : PAL.shade);
    m.userData.rim.visible = !stunned;
    m.scale.setScalar(stunned ? 0.8 : 1 + Math.sin(time * 5) * 0.05);
  });
  sync(pools.drifters, sim.drifters.filter((d) => d.state !== 'removed'), makeDrifter, (m, d) => {
    m.position.set(d.pos[0], d.pos[1] + 0.5, d.pos[2]);
    m.lookAt(p.pos[0], m.position.y, p.pos[2]);
    m.rotateY(Math.PI / 2);
    const pos = m.geometry.attributes.position, base = m.userData.base;
    for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(time * 8 + base[i * 3] * 2) * 0.25;
    pos.needsUpdate = true;
    m.material.opacity = d.state === 'flee' ? 0.5 : 0.85;
  });
  sync(pools.charms, sim.charms, makeCharm, (m, c) => {
    m.visible = c.available;
    m.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(time * 2) * 0.15, c.pos[2]);
    m.rotation.y = time * 1.5;
  });

  if (waveT < 1) { waveT += frame / 400; wave.scale.setScalar(Math.max(0.01, waveT * T.pulse_radius)); wave.material.opacity = 1 - waveT; }

  // wind leaves (warning + active)
  const windy = windWarning(sim) || sim.wind.active;
  leaves.visible = windy;
  if (sim.wind.active && !windOn) sfx.wind();
  windOn = sim.wind.active;
  if (windy) {
    const a = (sim.wind.dirDeg * Math.PI) / 180, arr = leaves.geometry.attributes.position.array;
    for (let i = 0; i < 100; i++) {
      const u = ((time * (sim.wind.active ? 0.5 : 0.15) + i * 0.137) % 1) * 30 - 15, v = ((i * 7.13) % 30) - 15;
      arr[i * 3] = p.pos[0] + Math.cos(a) * u - Math.sin(a) * v;
      arr[i * 3 + 1] = p.pos[1] + 0.5 + ((i * 3.7) % 4);
      arr[i * 3 + 2] = p.pos[2] + Math.sin(a) * u + Math.cos(a) * v;
    }
    leaves.geometry.attributes.position.needsUpdate = true;
  }

  const th = (yaw * Math.PI) / 180;
  const camY = Math.max(p.pos[1], -6);
  camera.position.set(p.pos[0] - Math.sin(th) * 9, camY + 6, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], camY + 1.2, p.pos[2]);

  if (toastT > 0 && (toastT -= frame / 1000) <= 0) $('toast').style.opacity = 0;
  drawHud();
  renderer.render(scene, camera);
});

// Screenshot / benchmark helpers: ?auto=1 skips menus; ?night=N picks the night; ?lit=N pre-lights lanterns.
if (params.has('auto')) { startNight(+(params.get('night') ?? 1)); play(); }
window.__ddl = { get sim() { return sim; }, fps: () => fpsSamples };
