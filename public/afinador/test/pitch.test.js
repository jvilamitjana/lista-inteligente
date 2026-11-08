// Prueba de precisión del detector: node public/afinador/test/pitch.test.js
const { PitchDetector, Music } = require("../pitch.js");
const SR = 48000, N = 4096;
const det = new PitchDetector(SR, N);
function synth(f, kind, noise) {
  const b = new Float32Array(N);
  const ph = Math.random() * 6.28;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let v = 0;
    if (kind === "seno") v = Math.sin(2 * Math.PI * f * t + ph);
    else // "voz": 12 armónicos con fundamental débil
      for (let h = 1; h <= 12; h++) v += (h === 1 ? 0.3 : 1 / h) * Math.sin(2 * Math.PI * f * h * t + ph * h);
    b[i] = 0.3 * v + noise * (Math.random() * 2 - 1);
  }
  return b;
}
const cases = [ // [tipo, ruido, error máx. permitido en cents]
  ["seno", 0, 0.1], ["voz", 0, 0.1], ["seno", 0.05, 1.5], ["voz", 0.05, 1],
];
let ok = true;
for (const [kind, noise, tol] of cases) {
  let worst = 0, sum = 0, cnt = 0;
  for (let midi = 40; midi <= 88; midi += 0.13) { // Mi2 (82 Hz) .. Mi6 (1319 Hz)
    const f = Music.midiToFreq(midi);
    const r = det.detect(synth(f, kind, noise));
    const err = r.freq ? Math.abs(1200 * Math.log2(r.freq / f)) : Infinity;
    worst = Math.max(worst, err); sum += err; cnt++;
  }
  const pass = worst <= tol;
  ok = ok && pass;
  console.log(`${pass ? "OK " : "MAL"} ${kind.padEnd(4)} ruido=${noise}  error medio=${(sum / cnt).toFixed(4)} c  máx=${worst.toFixed(4)} c`);
}
const silent = det.detect(new Float32Array(N));
const noiseOnly = det.detect(synth(0, "seno", 0.3));
console.log("silencio ->", silent.freq, "| solo ruido ->", noiseOnly.freq.toFixed(1));
ok = ok && silent.freq === 0 && noiseOnly.freq === 0;
const t0 = Date.now(), buf = synth(220, "voz", 0.02);
for (let i = 0; i < 200; i++) det.detect(buf);
console.log("tiempo por análisis:", ((Date.now() - t0) / 200).toFixed(2), "ms");
process.exit(ok ? 0 : 1);
