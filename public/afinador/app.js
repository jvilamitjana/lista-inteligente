/* Afinador Vocal — lógica de la aplicación */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const Music = window.Music;

  // ---------- Ajustes persistentes ----------
  const DEFAULTS = { a4: 440, notation: "latin", tol: 5, smooth: 2, hist: 10, sens: 60, mode: "free", target: 57, zoom: false };
  const settings = Object.assign({}, DEFAULTS);
  try { Object.assign(settings, JSON.parse(localStorage.getItem("afinador.settings") || "{}")); } catch (e) { /* sin almacenamiento */ }
  const save = () => { try { localStorage.setItem("afinador.settings", JSON.stringify(settings)); } catch (e) { /* ignorar */ } };

  const SMOOTH = [ // [ventana mediana, alfa EMA]
    [1, 1], [3, 0.6], [5, 0.35], [7, 0.18],
  ];
  const sensToRms = (s) => Math.pow(10, -1 - (s / 100) * 2.5);

  // ---------- Estado de audio ----------
  let ctx = null, analyser = null, stream = null, detector = null, buf = null;
  let running = false, wakeLock = null;
  let refOsc = null, refGain = null;

  // ---------- Estado de análisis ----------
  const history = []; // { t, midi } ; midi = null => silencio
  let medianBuf = [];
  let display = null;      // midi suavizado mostrado
  let lastVoicedAt = 0;
  let lastAnalysis = 0;
  let pendingJump = null;  // protección contra saltos de octava aislados
  let lastRaw = null;
  let viewCenter = settings.target;
  let lastClarity = 0;
  let seg = null;          // estadísticas de la nota sostenida actual

  // ---------- Utilidades ----------
  const fmtNote = (midi) => Music.noteName(midi, settings.notation === "latin");
  const noteLabel = (midi) => { const n = fmtNote(midi); return n.name + n.octave; };
  const signed = (v, d) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(d);
  // Desviación: en cents si es menor de un semitono; si no, en semitonos
  const fmtDev = (c, unit) => Math.abs(c) < 99.95
    ? (Math.abs(c) < 0.05 ? "0.0" : signed(c, 1)) + unit
    : signed(c / 100, 1) + " st";
  const levelClass = (c) => {
    const a = Math.abs(c);
    return a <= settings.tol ? "good" : a <= settings.tol * 2.5 ? "warn" : "bad";
  };
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const COLORS = {};
  function readColors() {
    ["--good", "--warn", "--bad", "--text", "--muted", "--line", "--card-2", "--accent"].forEach((k) => (COLORS[k.slice(2)] = css(k)));
  }
  readColors();
  const median = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; };

  // ---------- Micrófono ----------
  async function start() {
    const errEl = $("startError");
    errEl.hidden = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errEl.textContent = "Este navegador no permite acceder al micrófono. Abre la app por HTTPS en Chrome, Safari o Firefox.";
      errEl.hidden = false;
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (e) {
      errEl.textContent = e && e.name === "NotAllowedError"
        ? "Permiso de micrófono denegado. Actívalo en los ajustes del navegador y vuelve a intentarlo."
        : "No se pudo abrir el micrófono (" + (e && e.message ? e.message : e) + ").";
      errEl.hidden = false;
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    if (ctx.state === "suspended") await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    // Filtro paso alto suave para quitar golpes y zumbidos graves
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 45; hp.Q.value = 0.7;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    src.connect(hp).connect(analyser);
    buf = new Float32Array(analyser.fftSize);
    detector = new window.PitchDetector(ctx.sampleRate, analyser.fftSize, { minFreq: 55, maxFreq: 1700, minRms: sensToRms(settings.sens) });
    running = true;
    $("startOverlay").hidden = true;
    $("btnPower").classList.add("on");
    requestWakeLock();
    requestAnimationFrame(loop);
  }

  async function togglePower() {
    if (!ctx) { $("startOverlay").hidden = false; return; }
    if (running) {
      running = false;
      stopRef();
      await ctx.suspend();
      $("btnPower").classList.remove("on");
      releaseWakeLock();
      setIdle(true);
    } else {
      await ctx.resume();
      running = true;
      $("btnPower").classList.add("on");
      requestWakeLock();
      requestAnimationFrame(loop);
    }
  }

  async function requestWakeLock() {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* no disponible */ }
  }
  function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch (e) { /* ignorar */ } wakeLock = null; }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && running) {
      requestWakeLock();
      if (ctx && ctx.state !== "running") ctx.resume();
    }
  });

  // ---------- Tono de referencia ----------
  function startRef() {
    if (!ctx) return;
    stopRef(true);
    refOsc = ctx.createOscillator();
    refOsc.type = "triangle";
    refOsc.frequency.value = Music.midiToFreq(settings.target, settings.a4);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1800;
    refGain = ctx.createGain();
    refGain.gain.setValueAtTime(0, ctx.currentTime);
    refGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    refOsc.connect(lp).connect(refGain).connect(ctx.destination);
    refOsc.start();
    $("tPlay").classList.add("on");
    $("tPlay").textContent = "■ Parar";
  }
  function stopRef(silent) {
    if (refOsc) {
      const o = refOsc, g = refGain, t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.05);
      o.stop(t + 0.06);
      refOsc = null; refGain = null;
    }
    if (!silent) { $("tPlay").classList.remove("on"); $("tPlay").textContent = "▶ Escuchar"; }
  }
  function updateRefFreq() {
    if (refOsc) refOsc.frequency.setTargetAtTime(Music.midiToFreq(settings.target, settings.a4), ctx.currentTime, 0.01);
  }

  // ---------- Bucle principal ----------
  function loop(now) {
    if (!running) return;
    if (now - lastAnalysis >= 20) { lastAnalysis = now; analyse(now); }
    drawGauge();
    drawHistory(now);
    requestAnimationFrame(loop);
  }

  function analyse(now) {
    analyser.getFloatTimeDomainData(buf);
    const r = detector.detect(buf);
    lastClarity = r.clarity;
    let midi = r.freq > 0 ? Music.freqToMidi(r.freq, settings.a4) : null;

    // Rechazar un salto de ~octava aislado (error típico de detectores)
    if (midi != null && lastRaw != null && now - lastVoicedAt < 150) {
      const jump = Math.abs(midi - lastRaw);
      if (jump > 10.5 && jump < 13.5 && (!pendingJump || Math.abs(pendingJump - midi) > 0.5)) {
        pendingJump = midi;
        midi = null;
      } else pendingJump = null;
    }

    if (midi == null) {
      history.push({ t: now, midi: null });
      if (now - lastVoicedAt > 250) { medianBuf = []; setIdle(true); }
      if (now - lastVoicedAt > 400) seg = null;
      trimHistory(now);
      updateClarity(r);
      return;
    }

    lastRaw = midi;
    lastVoicedAt = now;
    const [win, alpha] = SMOOTH[settings.smooth] || SMOOTH[2];
    // Si cambia de nota, reiniciar la ventana para responder al instante
    if (medianBuf.length && Math.abs(midi - median(medianBuf)) > 0.7) { medianBuf = []; display = null; }
    medianBuf.push(midi);
    while (medianBuf.length > Math.max(3, win)) medianBuf.shift();
    const m3 = median(medianBuf.slice(-3));          // sin picos, conserva vibrato
    const mw = median(medianBuf.slice(-win));
    display = display == null || alpha >= 1 ? mw : display + alpha * (mw - display);

    history.push({ t: now, midi: m3 });
    trimHistory(now);
    updateStats(now, m3);
    updateReadout(r.freq);
    updateClarity(r);
  }

  function trimHistory(now) {
    const keep = (settings.hist + 1) * 1000;
    while (history.length && now - history[0].t > keep) history.shift();
  }

  function refMidi(m) { return settings.mode === "target" ? settings.target : Math.round(m); }

  // ---------- Estadísticas de nota sostenida ----------
  function updateStats(now, m) {
    const ref = refMidi(m);
    if (!seg || seg.ref !== ref) seg = { ref, start: now, n: 0, inTol: 0, sum: 0, sq: 0 };
    if (now - seg.start < 150) { renderStats(); return; } // ignorar el ataque
    const c = (m - ref) * 100;
    seg.n++; seg.sum += c; seg.sq += c * c;
    if (Math.abs(c) <= settings.tol) seg.inTol++;
    seg.last = now;
    renderStats();
  }
  function renderStats() {
    if (!seg || !seg.n) return;
    const mean = seg.sum / seg.n;
    const sd = Math.sqrt(Math.max(0, seg.sq / seg.n - mean * mean));
    const pct = (100 * seg.inTol) / seg.n;
    const el = $("stInTune");
    el.textContent = pct.toFixed(0) + "%";
    el.className = pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad";
    $("stMean").textContent = fmtDev(mean, "¢");
    $("stMean").className = levelClass(mean);
    $("stSd").textContent = sd.toFixed(1) + "¢";
    $("stDur").textContent = (((seg.last || seg.start) - seg.start) / 1000).toFixed(1) + " s";
  }

  // ---------- Lectura ----------
  function setIdle(idle) { document.querySelector(".readout").classList.toggle("idle", idle); }

  function updateReadout(freq) {
    setIdle(false);
    const ref = refMidi(display);
    const cents = (display - ref) * 100;
    const n = fmtNote(settings.mode === "target" ? Math.round(display) : ref);
    const noteEl = $("noteName");
    noteEl.textContent = n.name;
    noteEl.style.fontSize = n.name.length > 3 ? "62px" : n.name.length > 2 ? "72px" : "";
    $("noteOctave").textContent = n.octave;
    const cl = levelClass(cents);
    noteEl.className = "note " + cl;
    const centsEl = $("cents");
    centsEl.textContent = fmtDev(cents, " ¢");
    centsEl.className = "cents " + cl;
    $("freq").textContent = Music.midiToFreq(display, settings.a4).toFixed(2) + " Hz";
    if (settings.mode === "target") {
      const st = Math.round(cents / 100);
      $("targetInfo").textContent = st === 0
        ? (Math.abs(cents) <= settings.tol ? "¡En la nota!" : cents > 0 ? "Un poco alto ↓" : "Un poco bajo ↑")
        : Math.abs(st) + (Math.abs(st) === 1 ? " semitono " : " semitonos ") + (st > 0 ? "por encima ↓" : "por debajo ↑");
    } else {
      $("targetInfo").textContent = Math.abs(cents) <= settings.tol ? "Afinado" : cents > 0 ? "Alto ↓" : "Bajo ↑";
    }
  }

  function updateClarity(r) {
    const p = $("clarity");
    if (r.freq > 0) p.textContent = "claridad " + Math.round(r.clarity * 100) + "%";
    else if (r.rms < (detector ? detector.minRms : 0)) p.textContent = "silencio";
    else p.textContent = "sin tono claro";
  }

  // ---------- Canvas ----------
  function fitCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  }

  function currentCents() {
    if (display == null) return null;
    return (display - refMidi(display)) * 100;
  }

  function drawScale(g, x0, x1, y, range, minor, major, labelEvery, cents, active, title) {
    const W = x1 - x0;
    const X = (c) => x0 + ((Math.max(-range, Math.min(range, c)) + range) / (2 * range)) * W;
    // zona de tolerancia
    const tol = Math.min(settings.tol, range);
    g.fillStyle = COLORS.good + "33";
    g.fillRect(X(-tol), y - 14, X(tol) - X(-tol), 28);
    g.fillStyle = COLORS.warn + "14";
    const t2 = Math.min(settings.tol * 2.5, range);
    g.fillRect(X(-t2), y - 14, X(-tol) - X(-t2), 28);
    g.fillRect(X(tol), y - 14, X(t2) - X(tol), 28);
    // marcas
    g.strokeStyle = COLORS.muted;
    g.fillStyle = COLORS.muted;
    g.font = "11px system-ui, sans-serif";
    g.textAlign = "center";
    const steps = Math.round((2 * range) / minor);
    for (let i = 0; i <= steps; i++) {
      const c = -range + i * minor;
      const isMajor = Math.abs(c / major - Math.round(c / major)) < 1e-6;
      const isZero = Math.abs(c) < 1e-6;
      g.globalAlpha = isZero ? 1 : isMajor ? 0.7 : 0.35;
      g.lineWidth = isZero ? 2 : 1;
      const len = isZero ? 14 : isMajor ? 9 : 5;
      g.beginPath(); g.moveTo(X(c), y - len); g.lineTo(X(c), y + len); g.stroke();
      if (Math.abs(c / labelEvery - Math.round(c / labelEvery)) < 1e-6) {
        g.globalAlpha = 0.8;
        g.fillText((c > 0 ? "+" : "") + c, X(c), y + 27);
      }
    }
    g.globalAlpha = 1;
    g.textAlign = "left";
    g.fillText(title, x0, y - 20);
    // aguja
    if (cents != null) {
      const cl = levelClass(cents);
      const col = active ? COLORS[cl] : COLORS.muted;
      const x = X(cents);
      g.fillStyle = col; g.strokeStyle = col;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x, y + 16); g.stroke();
      g.beginPath(); g.moveTo(x - 7, y - 22); g.lineTo(x + 7, y - 22); g.lineTo(x, y - 14); g.closePath(); g.fill();
      if (Math.abs(cents) > range) { // fuera de escala: flecha
        g.font = "bold 14px system-ui"; g.textAlign = cents > 0 ? "right" : "left";
        g.fillText(cents > 0 ? "▶" : "◀", cents > 0 ? x1 : x0, y + 5);
      }
    }
  }

  function drawGauge() {
    const { g, w, h } = fitCanvas($("gauge"));
    g.clearRect(0, 0, w, h);
    const c = currentCents();
    const active = !document.querySelector(".readout").classList.contains("idle");
    const pad = 14;
    const yA = h * 0.27, yB = h * 0.74;
    drawScale(g, pad, w - pad, yA, 50, 5, 10, 25, c, active, "± 50 ¢");
    drawScale(g, pad, w - pad, yB, 10, 0.5, 1, 5, c, active, "Lupa ± 10 ¢");
  }

  function drawHistory(now) {
    const { g, w, h } = fitCanvas($("history"));
    g.clearRect(0, 0, w, h);
    const span = settings.hist * 1000;
    const range = settings.zoom ? 0.5 : 2.5; // semitonos visibles a cada lado
    // centro de la vista
    let desired = viewCenter;
    if (settings.mode === "target") desired = settings.target;
    else if (display != null) desired = Math.round(display);
    viewCenter += (desired - viewCenter) * 0.12;
    if (Math.abs(desired - viewCenter) < 0.002) viewCenter = desired;

    const left = 40;
    const Y = (m) => h / 2 - ((m - viewCenter) / range) * (h / 2);
    const X = (t) => left + (1 - (now - t) / span) * (w - left - 6);

    // líneas de semitono, bandas de tolerancia y etiquetas
    g.font = "11px system-ui, sans-serif";
    g.textAlign = "right";
    g.textBaseline = "middle";
    const lo = Math.floor(viewCenter - range - 1), hi = Math.ceil(viewCenter + range + 1);
    for (let m = lo; m <= hi; m++) {
      const y = Y(m);
      if (y < -10 || y > h + 10) continue;
      const isTarget = settings.mode === "target" && m === settings.target;
      const band = (settings.tol / 100 / range) * (h / 2);
      g.fillStyle = COLORS.good + (isTarget ? "40" : "1c");
      g.fillRect(left, y - band, w - left, band * 2);
      g.strokeStyle = isTarget ? COLORS.good : COLORS.line;
      g.lineWidth = isTarget ? 1.5 : 1;
      g.beginPath(); g.moveTo(left, y); g.lineTo(w, y); g.stroke();
      g.fillStyle = isTarget ? COLORS.good : COLORS.muted;
      g.fillText(noteLabel(m), left - 6, y);
      // cuarto de tono, discontinua
      g.strokeStyle = COLORS.line; g.setLineDash([2, 4]);
      const yq = Y(m + 0.5);
      g.beginPath(); g.moveTo(left, yq); g.lineTo(w, yq); g.stroke();
      g.setLineDash([]);
    }

    // Vista ampliada: rejilla de cents alrededor de la nota central
    if (settings.zoom) {
      const base = Math.round(viewCenter);
      g.textAlign = "left";
      for (let c = -40; c <= 40; c += 10) {
        if (!c) continue;
        const y = Y(base + c / 100);
        g.strokeStyle = COLORS.line; g.globalAlpha = 0.6;
        g.beginPath(); g.moveTo(left, y); g.lineTo(w, y); g.stroke();
        g.globalAlpha = 1; g.fillStyle = COLORS.muted;
        g.fillText((c > 0 ? "+" : "") + c + "¢", left + 4, y - 7);
      }
      g.textAlign = "right";
    }

    // trazo
    g.lineWidth = 2.5;
    g.lineCap = "round";
    let prev = null;
    for (let i = 0; i < history.length; i++) {
      const p = history[i];
      if (p.midi == null) { prev = null; continue; }
      if (prev && p.t - prev.t < 150 && Math.abs(p.midi - prev.midi) < 0.6) {
        const ref = settings.mode === "target" ? settings.target : Math.round(p.midi);
        g.strokeStyle = COLORS[levelClass((p.midi - ref) * 100)];
        g.beginPath(); g.moveTo(X(prev.t), Y(prev.midi)); g.lineTo(X(p.t), Y(p.midi)); g.stroke();
      }
      prev = p;
    }
    const last = history[history.length - 1];
    if (last && last.midi != null && now - last.t < 200) {
      const ref = settings.mode === "target" ? settings.target : Math.round(last.midi);
      g.fillStyle = COLORS[levelClass((last.midi - ref) * 100)];
      g.beginPath(); g.arc(X(last.t), Y(last.midi), 4.5, 0, Math.PI * 2); g.fill();
    }
    // Indicador cuando el tono actual queda fuera de la vista
    if (last && last.midi != null && now - last.t < 300) {
      const y = Y(last.midi);
      if (y < 0 || y > h) {
        g.textAlign = "center"; g.fillStyle = COLORS.warn; g.font = "bold 13px system-ui";
        g.fillText((y < 0 ? "▲ " : "▼ ") + noteLabel(last.midi), (w + left) / 2, y < 0 ? 12 : h - 12);
      }
    }
    if (!history.some((p) => p.midi != null)) {
      g.textAlign = "center"; g.fillStyle = COLORS.muted; g.font = "14px system-ui";
      g.fillText(running ? "Canta o toca una nota…" : "Micrófono en pausa", (w + left) / 2, h / 2 - 20);
    }
  }

  // ---------- Controles ----------
  function setMode(mode) {
    settings.mode = mode; save();
    $("modeFree").classList.toggle("active", mode === "free");
    $("modeTarget").classList.toggle("active", mode === "target");
    $("targetControls").hidden = mode !== "target";
    if (mode !== "target") stopRef();
    seg = null;
    renderTarget();
  }
  function renderTarget() {
    $("tName").textContent = noteLabel(settings.target);
    $("tFreq").textContent = Music.midiToFreq(settings.target, settings.a4).toFixed(2) + " Hz";
  }
  function setTarget(m) {
    settings.target = Math.max(28, Math.min(96, Math.round(m)));
    save(); seg = null; renderTarget(); updateRefFreq();
  }

  function renderSettings() {
    $("a4Out").textContent = settings.a4.toFixed(1) + " Hz";
    document.querySelectorAll("[data-notation]").forEach((b) => b.classList.toggle("active", b.dataset.notation === settings.notation));
    document.querySelectorAll("[data-tol]").forEach((b) => b.classList.toggle("active", +b.dataset.tol === settings.tol));
    document.querySelectorAll("[data-smooth]").forEach((b) => b.classList.toggle("active", +b.dataset.smooth === settings.smooth));
    document.querySelectorAll("[data-hist]").forEach((b) => b.classList.toggle("active", +b.dataset.hist === settings.hist));
    $("sens").value = settings.sens;
    renderTarget();
  }

  $("btnStart").addEventListener("click", start);
  $("btnPower").addEventListener("click", togglePower);
  $("btnSettings").addEventListener("click", () => { $("settingsSheet").hidden = false; });
  document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", () => { $("settingsSheet").hidden = true; }));

  document.querySelectorAll("[data-a4]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    settings.a4 = Math.round(Math.max(400, Math.min(480, settings.a4 + parseFloat(b.dataset.a4))) * 10) / 10;
    save(); renderSettings(); updateRefFreq();
  }));
  document.querySelectorAll("[data-notation]").forEach((b) => b.addEventListener("click", () => { settings.notation = b.dataset.notation; save(); renderSettings(); }));
  document.querySelectorAll("[data-tol]").forEach((b) => b.addEventListener("click", () => { settings.tol = +b.dataset.tol; save(); seg = null; renderSettings(); }));
  document.querySelectorAll("[data-smooth]").forEach((b) => b.addEventListener("click", () => { settings.smooth = +b.dataset.smooth; save(); renderSettings(); }));
  document.querySelectorAll("[data-hist]").forEach((b) => b.addEventListener("click", () => { settings.hist = +b.dataset.hist; save(); renderSettings(); }));
  $("sens").addEventListener("input", (e) => {
    settings.sens = +e.target.value; save();
    if (detector) detector.minRms = sensToRms(settings.sens);
  });

  $("modeFree").addEventListener("click", () => setMode("free"));
  $("modeTarget").addEventListener("click", () => setMode("target"));
  $("tDown").addEventListener("click", () => setTarget(settings.target - 1));
  $("tUp").addEventListener("click", () => setTarget(settings.target + 1));
  $("tLock").addEventListener("click", () => { if (display != null) setTarget(display); });
  $("tPlay").addEventListener("click", () => (refOsc ? stopRef() : startRef()));

  $("history").addEventListener("click", () => { settings.zoom = !settings.zoom; save(); renderZoom(); });
  function renderZoom() { $("zoomHint").textContent = settings.zoom ? "± 50 ¢ · toca para alejar" : "± 2,5 st · toca para ampliar"; }
  renderZoom();

  window.addEventListener("resize", () => { drawGauge(); drawHistory(performance.now()); });

  renderSettings();
  setMode(settings.mode);
  setIdle(true);
  drawGauge();
  drawHistory(performance.now());

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
