// Static world geometry per night (visual only; collision lives in src/core/maps.js).
import * as THREE from 'three';

export const PAL = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e, moteCore: 0xfff6c2, moteGlow: 0xffe58a,
  shade: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450, shirt: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8, danger: 0xff5a5f, ui: 0xf5f1e6,
};

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

function disc(r, cx = 0, cz = 0, top = 0, h = 4) {
  const g = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 64), mat(PAL.grass));
  grass.position.set(cx, top - 0.2, cz);
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.1, r * 0.55, h, 48), mat(PAL.sand, { flatShading: true }));
  rock.position.set(cx, top - 0.4 - h / 2, cz);
  g.add(grass, rock);
  return g;
}

function deco(group, n, rMin, rMax, cx, cz, ok) {
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, r = rMin + ((i * 7.31) % (rMax - rMin));
    const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
    if (ok && !ok(x, z)) continue;
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + (i % 3) * 0.25, 0), mat(0x24493f, { flatShading: true }));
    bush.position.set(x, 0.25, z);
    group.add(bush);
  }
}

export function makePad(pos) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.25, 32), mat(PAL.wood));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 32), new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.6 }));
  top.position.y = 0.14;
  g.add(base, top);
  g.position.set(pos[0], pos[1] + 0.05, pos[2]);
  return g;
}

export function buildWorld(night) {
  const g = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), mat(PAL.sea));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -12;
  g.add(sea);

  if (night === 1) {
    g.add(disc(40));
    deco(g, 40, 5, 39, 0, 0);
  } else if (night === 2) {
    g.add(disc(28), disc(28, 70, 0));
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(PAL.wood));
    bridge.position.set(35, -0.15, 0);
    g.add(bridge);
    for (let x = 26.5; x < 44; x += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 4.1), mat(0x4e3522));
      plank.position.set(x, -0.14, 0);
      g.add(plank);
    }
    deco(g, 26, 5, 27, 0, 0); deco(g, 26, 5, 27, 70, 0);
  } else {
    g.add(disc(45, 0, 0, 0, 5));
    // tier 1: half annulus r 12..24, z > 0, top Y=3
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false);
    shape.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 48 }), mat(PAL.grass));
    tier1.rotation.x = -Math.PI / 2; // shape y -> world -z ; extrusion -> world +y
    g.add(tier1);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), mat(PAL.grass));
    tier2.position.y = 3;
    g.add(tier2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), mat(PAL.wood));
    tower.position.y = 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2, 8), mat(0x7a2e1e));
    roof.position.y = 15;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(PAL.gold, { metalness: 0.6, roughness: 0.4 }));
    bell.position.y = 13.2;
    g.add(tower, roof, bell);
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180, len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), mat(PAL.sand));
      ramp.position.set(27 * Math.cos(a), 1.5, 27 * Math.sin(a));
      // Euler 'YXZ' = Ry * Rz: tilt first (outer end, local +x, lower), then turn local +x to point outward.
      ramp.rotation.order = 'YXZ';
      ramp.rotation.z = -Math.atan2(3, 6);
      ramp.rotation.y = -a;
      g.add(ramp);
    }
    deco(g, 50, 26, 44, 0, 0, (x, z) => !(z > 0 && Math.hypot(x, z) < 25));
  }
  return g;
}
