// Standard maps (Ticket-02 Part 2). Angles from +X towards +Z: (r cos a, y, r sin a).
const rad = (d) => (d * Math.PI) / 180;
const ring = (n, r, startDeg, stepDeg, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rad(startDeg + i * stepDeg)), y, cz + r * Math.sin(rad(startDeg + i * stepDeg))]);
const lanterns = (list) => list.map((pos, i) => ({ id: `L${i + 1}`, pos }));
const dirTo = (from, to, speed) => {
  const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz);
  return [(dx / d) * speed, (dz / d) * speed];
};

const night1 = {
  night: 1, name: 'Đảo Bến', duration_s: 300, start: [0, 0, 0],
  ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  lanterns: lanterns([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
  moteSpawns: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadeSpawns: ring(12, 37, 15, 30),
  shadeEvery: 480, shadeMax: 6, shadeSpeed: 4,
  pads: [], charms: [], drifters: false, wind: false,
};

const night2 = {
  night: 2, name: 'Đảo Cau', duration_s: 330, start: [0, 0, 0],
  ground: (x, z) => {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  },
  lanterns: lanterns([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
  moteSpawns: [0, 70].flatMap((cx) => [...ring(4, 10, 0, 90, 0, cx), ...ring(8, 22, 0, 45, 0, cx)]),
  shadeSpawns: [0, 70].flatMap((cx) => ring(8, 26, 22.5, 45, 0, cx)),
  shadeEvery: 420, shadeMax: 8, shadeSpeed: 4,
  pads: [
    { pos: [20, 0, 18], vy: 14, hv: dirTo([20, 0, 18], [70, 0, 0], 24) },
    { pos: [50, 0, -18], vy: 14, hv: dirTo([50, 0, -18], [0, 0, 0], 24) },
  ],
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  drifters: true, wind: false,
};

const RAMPS = [30, 150].map((d) => [Math.cos(rad(d)), Math.sin(rad(d))]);
const night3 = {
  // ASSUMPTION: (0,0,0) is inside the bell tower, so Night 3 starts on tier 0 south of the tower.
  night: 3, name: 'Đảo Chuông', duration_s: 360, start: [0, 0, -20],
  ground: (x, z) => {
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    if (r < 2) return 14; // bell tower (8 m on top of tier 2) — acts as an unclimbable wall
    if (r <= 8) return 6;
    if (z > 0 && r >= 12 && r <= 24) return 3;
    for (const [ux, uz] of RAMPS) {
      const s = x * ux + z * uz, t = -x * uz + z * ux;
      if (Math.abs(t) <= 1.5 && s >= 24 && s <= 30) return (3 * (30 - s)) / 6;
    }
    return 0;
  },
  lanterns: lanterns([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
  moteSpawns: [...ring(18, 34, 0, 20, 0), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
  shadeSpawns: ring(16, 43, 0, 22.5),
  shadeEvery: 360, shadeMax: 10, shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], vy: 12, hv: [0, -8] }],
  charms: [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }],
  drifters: true, wind: true,
};

export const NIGHTS = { 1: night1, 2: night2, 3: night3 };
