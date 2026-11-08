/*
 * Detector de tono de alta precisión basado en el algoritmo McLeod Pitch
 * Method (MPM / NSDF) con autocorrelación por FFT e interpolación parabólica
 * para obtener precisión sub-muestra (décimas de cent en tonos estables).
 *
 * Uso: const det = new PitchDetector(sampleRate, bufferSize);
 *      const r = det.detect(float32Buffer); // { freq, clarity, rms } | null
 */
(function (root) {
  "use strict";

  function nextPow2(n) {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  // FFT radix-2 in-place (re, im: Float64Array)
  function makeFFT(size) {
    const levels = Math.log2(size) | 0;
    const rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let x = i, y = 0;
      for (let j = 0; j < levels; j++) { y = (y << 1) | (x & 1); x >>>= 1; }
      rev[i] = y;
    }
    const cos = new Float64Array(size / 2);
    const sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      cos[i] = Math.cos((2 * Math.PI * i) / size);
      sin[i] = Math.sin((2 * Math.PI * i) / size);
    }
    return function fft(re, im, inverse) {
      for (let i = 0; i < size; i++) {
        const j = rev[i];
        if (j > i) {
          let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
        }
      }
      const s = inverse ? -1 : 1;
      for (let len = 2; len <= size; len <<= 1) {
        const half = len >> 1;
        const step = size / len;
        for (let i = 0; i < size; i += len) {
          for (let j = 0, k = 0; j < half; j++, k += step) {
            const wr = cos[k], wi = -s * sin[k];
            const a = i + j, b = a + half;
            const xr = re[b] * wr - im[b] * wi;
            const xi = re[b] * wi + im[b] * wr;
            re[b] = re[a] - xr; im[b] = im[a] - xi;
            re[a] += xr; im[a] += xi;
          }
        }
      }
    };
  }

  // Interpolación parabólica para precisión sub-muestra
  function interp(a, i) {
    const y0 = a[i - 1], y1 = a[i], y2 = a[i + 1];
    const denom = y0 - 2 * y1 + y2;
    if (denom === 0) return { pos: i, val: y1 };
    let shift = 0.5 * (y0 - y2) / denom;
    if (shift > 1) shift = 1; else if (shift < -1) shift = -1;
    return { pos: i + shift, val: y1 - 0.25 * (y0 - y2) * shift };
  }

  function PitchDetector(sampleRate, bufferSize, opts) {
    opts = opts || {};
    this.sampleRate = sampleRate;
    this.n = bufferSize;
    this.minFreq = opts.minFreq || 50;
    this.maxFreq = opts.maxFreq || 2000;
    this.cutoff = opts.cutoff || 0.93; // umbral relativo para elegir pico (MPM k)
    this.minClarity = opts.minClarity || 0.8;
    this.minRms = opts.minRms != null ? opts.minRms : 0.01;
    this.size = nextPow2(bufferSize * 2);
    this.fft = makeFFT(this.size);
    this.re = new Float64Array(this.size);
    this.im = new Float64Array(this.size);
    this.nsdf = new Float64Array(bufferSize + 1);
    this.refine = opts.refine !== false;
    this.maxHarmonicHz = opts.maxHarmonicHz || 4000;
    this.win = new Float64Array(bufferSize);
    for (let i = 0; i < bufferSize; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (bufferSize - 1));
  }

  PitchDetector.prototype.detect = function (buf) {
    const n = this.n, size = this.size, re = this.re, im = this.im;
    // Eliminar componente DC y medir RMS
    let mean = 0;
    for (let i = 0; i < n; i++) mean += buf[i];
    mean /= n;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const v = buf[i] - mean;
      re[i] = v; im[i] = 0;
      energy += v * v;
    }
    for (let i = n; i < size; i++) { re[i] = 0; im[i] = 0; }
    const rms = Math.sqrt(energy / n);
    if (rms < this.minRms) return { freq: 0, clarity: 0, rms: rms };

    // Autocorrelación: IFFT(|FFT(x)|^2)
    this.fft(re, im, false);
    for (let i = 0; i < size; i++) {
      re[i] = re[i] * re[i] + im[i] * im[i];
      im[i] = 0;
    }
    this.fft(re, im, true);
    // re[tau]/size = r(tau)

    const maxTau = Math.min(n - 2, Math.ceil(this.sampleRate / this.minFreq));
    const fullTau = Math.max(maxTau, n >> 1); // NSDF extendida para refinar
    const minTau = Math.max(2, Math.floor(this.sampleRate / this.maxFreq));
    const nsdf = this.nsdf;
    // m(tau) = sum_{j=0}^{n-1-tau} x[j]^2 + x[j+tau]^2
    let m = 2 * energy;
    const x0 = buf; // usamos valores sin DC: recalcular sobre la marcha
    for (let tau = 0; tau <= fullTau; tau++) {
      if (tau > 0) {
        const a = x0[tau - 1] - mean, b = x0[n - tau] - mean;
        m -= a * a + b * b;
      }
      nsdf[tau] = m > 0 ? (2 * re[tau] / size) / m : 0;
    }

    // Selección de picos (MPM): máximos entre cruces por cero positivos
    let tau = 1;
    while (tau < maxTau && nsdf[tau] > 0) tau++; // saltar lóbulo central
    const peaks = [];
    let maxVal = -Infinity;
    while (tau < maxTau) {
      while (tau < maxTau && nsdf[tau] <= 0) tau++;
      let best = -1, bestVal = -Infinity;
      while (tau < maxTau && nsdf[tau] > 0) {
        if (nsdf[tau] > bestVal && tau >= minTau) { bestVal = nsdf[tau]; best = tau; }
        tau++;
      }
      if (best > 0) {
        peaks.push(best);
        if (bestVal > maxVal) maxVal = bestVal;
      }
    }
    if (!peaks.length) return { freq: 0, clarity: 0, rms: rms };

    const thresh = this.cutoff * maxVal;
    let chosen = peaks[0];
    for (let i = 0; i < peaks.length; i++) {
      if (nsdf[peaks[i]] >= thresh) { chosen = peaks[i]; break; }
    }

    const p1 = interp(nsdf, chosen);
    const clarity = Math.min(1, p1.val);
    if (clarity < this.minClarity) return { freq: 0, clarity: clarity, rms: rms };

    // Refinado: medir el pico de k periodos (k·P) y dividir entre k.
    // El error de interpolación se reparte entre k periodos -> mucha más precisión.
    let period = p1.pos;
    const limit = n >> 1;
    for (let k = Math.floor(limit / period); k >= 2; k--) {
      let c = Math.round(k * period);
      if (c + 2 >= fullTau) continue;
      for (let d = 0; d < 3; d++) { // escalar hasta el máximo local
        if (nsdf[c + 1] > nsdf[c]) c++; else if (nsdf[c - 1] > nsdf[c]) c--; else break;
      }
      const pk = interp(nsdf, c);
      if (pk.val >= 0.85 * p1.val && Math.abs(pk.pos / k - period) < 0.5) {
        period = pk.pos / k;
        break;
      }
    }
    let freq = this.sampleRate / period;
    if (this.refine) freq = this.refineHarmonic(buf, mean, freq);
    return { freq: freq, clarity: clarity, rms: rms };
  };

  // Energía armónica S(f) = Σ_h |DTFT(x·hann, h·f)|²  (Goertzel por armónico)
  PitchDetector.prototype.harmonicEnergy = function (buf, mean, f) {
    const n = this.n, w = this.win, sr = this.sampleRate;
    const H = Math.max(1, Math.min(10, Math.floor(this.maxHarmonicHz / f)));
    let total = 0;
    for (let h = 1; h <= H; h++) {
      const c = 2 * Math.cos((2 * Math.PI * h * f) / sr);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < n; i++) {
        const s0 = (buf[i] - mean) * w[i] + c * s1 - s2;
        s2 = s1; s1 = s0;
      }
      total += s1 * s1 + s2 * s2 - c * s1 * s2;
    }
    return total;
  };

  // Refinado de máxima verosimilitud armónica: rejilla gruesa de ±20 cents
  // (paso 2 c) y después sección áurea alrededor del mejor punto.
  PitchDetector.prototype.refineHarmonic = function (buf, mean, f0) {
    const self = this;
    const E = function (cents) { return self.harmonicEnergy(buf, mean, f0 * Math.pow(2, cents / 1200)); };
    let best = 0, bestE = -Infinity;
    for (let c = -20; c <= 20; c += 2) {
      const e = E(c);
      if (e > bestE) { bestE = e; best = c; }
    }
    if (Math.abs(best) >= 20) return f0; // sin máximo claro: conservar MPM
    const R = 0.6180339887;
    let a = best - 2, b = best + 2;
    let c = b - R * (b - a), d = a + R * (b - a);
    let ec = E(c), ed = E(d);
    for (let it = 0; it < 18; it++) {
      if (ec > ed) { b = d; d = c; ed = ec; c = b - R * (b - a); ec = E(c); }
      else { a = c; c = d; ec = ed; d = a + R * (b - a); ed = E(d); }
    }
    return f0 * Math.pow(2, (a + b) / 2 / 1200);
  };

  // Utilidades musicales
  const Music = {
    NAMES_EN: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"],
    NAMES_ES: ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"],
    freqToMidi: function (f, a4) { return 69 + 12 * Math.log2(f / (a4 || 440)); },
    midiToFreq: function (m, a4) { return (a4 || 440) * Math.pow(2, (m - 69) / 12); },
    noteName: function (midi, latin) {
      const names = latin ? Music.NAMES_ES : Music.NAMES_EN;
      const k = Math.round(midi);
      return { name: names[((k % 12) + 12) % 12], octave: Math.floor(k / 12) - 1 };
    }
  };

  root.PitchDetector = PitchDetector;
  root.Music = Music;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { PitchDetector: PitchDetector, Music: Music };
  }
})(typeof self !== "undefined" ? self : this);
