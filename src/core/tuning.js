// Single source of truth for gameplay numbers.
// tests/contract.test.js asserts game.contract.json "tuning" equals this object.
export const TUNING = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.2,
  interact_radius: 3,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 2,
  safe_radius: 6,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: { per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 2, per_flame_left: 50 },
};

// Non-contract world constants (documented in docs/notes/assumptions.md).
export const WORLD = {
  island_radius: 40,       // player is clamped inside (fall_enabled = false)
  lantern_ring_radius: 25, // L1..L5 evenly spaced, L1 at (0,0,25)
  gravity: 20,
  jump_speed: 7,
  motes_initial: 30,
  motes_min: 15,           // below this, respawn one mote every motes_respawn_s
  motes_respawn_s: 4,
  mote_spawn_radius: 36,
  shades_initial: 2,
  shades_max: 6,
  shade_spawn_every_s: 30,
  shade_spawn_radius: 38,
};
