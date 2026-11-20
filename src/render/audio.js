// All sound is synthesized with WebAudio (no external assets).
let ctx = null, master = null, musicGain = null, musicTimer = null;
let volume = 0.6;

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.25;
  musicGain.connect(master);
  return true;
}

export function setVolume(v) { volume = v; if (master) master.gain.value = v; }
export function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }

function tone(freq, dur, { type = 'sine', gain = 0.3, slide = 0, delay = 0, dest } = {}) {
  if (!ensure()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, gain = 0.2, freq = 800) {
  if (!ensure()) return;
  const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  pick: () => tone(1320 + Math.random() * 200, 0.12, { type: 'triangle', gain: 0.15 }),
  lit: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.2, delay: i * 0.09 })),
  deposit: () => tone(660, 0.2, { type: 'triangle', gain: 0.18, slide: 220 }),
  pulse: () => { tone(220, 0.5, { type: 'sine', gain: 0.35, slide: 660 }); noise(0.3, 0.1, 2000); },
  hit: () => { tone(160, 0.35, { type: 'sawtooth', gain: 0.25, slide: -100 }); noise(0.2, 0.2, 400); },
  jump: () => tone(440, 0.15, { type: 'square', gain: 0.08, slide: 300 }),
  dash: () => noise(0.18, 0.25, 1500),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.7, { type: 'triangle', gain: 0.2, delay: i * 0.14 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, { type: 'sine', gain: 0.22, delay: i * 0.2 })),
  shade: () => tone(110, 0.8, { type: 'sawtooth', gain: 0.12, slide: -40 }),
  tick: () => tone(1000, 0.06, { type: 'square', gain: 0.1 }),
  steal: () => tone(900, 0.3, { type: 'sine', gain: 0.18, slide: -600 }),
  charm: () => [880, 1175, 1568].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.15, delay: i * 0.06 })),
  wind: () => noise(1.5, 0.12, 500),
  fall: () => tone(600, 0.8, { type: 'sine', gain: 0.2, slide: -500 }),
};

// gentle night music: pentatonic plucks over a soft drone
const SCALE = [220, 247, 277, 330, 370, 440, 494, 554];
export function startMusic() {
  if (!ensure() || musicTimer) return;
  tone(110, 4, { type: 'sine', gain: 0.25, dest: musicGain });
  let i = 0;
  musicTimer = setInterval(() => {
    if (ctx.state !== 'running') return;
    if (i % 8 === 0) tone(110, 4, { type: 'sine', gain: 0.25, dest: musicGain });
    if (Math.random() < 0.7) tone(SCALE[Math.floor(Math.random() * SCALE.length)], 1.2, { type: 'triangle', gain: 0.12, dest: musicGain });
    i++;
  }, 500);
}
export function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
