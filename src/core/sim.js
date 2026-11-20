// Pure game logic. NO DOM, NO three.js, NO Date.now/Math.random here.
// Everything must be deterministic given (seed, inputs).

export const TICK_RATE = 60; // ticks per second (placeholder, revisit with Test Contract)

// mulberry32: small seeded PRNG, deterministic across platforms.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim({ seed = 1 } = {}) {
  return {
    seed,
    tick: 0,
    rng: makeRng(seed),
    player: { x: 0, y: 0, z: 0 },
  };
}

// input: { moveX: -1..1, moveZ: -1..1 }
export function step(sim, input = {}) {
  const speed = 4 / TICK_RATE;
  sim.player.x += (input.moveX ?? 0) * speed;
  sim.player.z += (input.moveZ ?? 0) * speed;
  sim.tick += 1;
  return sim;
}

export function snapshot(sim) {
  const r = (v) => Math.round(v * 1000) / 1000;
  return {
    tick: sim.tick,
    player: { x: r(sim.player.x), y: r(sim.player.y), z: r(sim.player.z) },
  };
}
