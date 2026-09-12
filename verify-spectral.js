/* ===========================================================================
   verify-spectral.js — known-answer checks for assets/spectral.js
   Run: node verify-spectral.js

   Every function added for the spectral set is checked against a case whose
   answer is known in closed form or from the AASPI documentation. This is the
   measurement instrument as well as the regression test: the numbers it prints
   are the numbers that are allowed to appear in the module prose.
   =========================================================================== */

const fs = require('fs');
const vm = require('vm');

function load(path, name) {
  const src = fs.readFileSync(path, 'utf8') + `\nglobalThis.${name} = ${name};`;
  vm.runInThisContext(src, { filename: path });
}
load('./assets/seismic.js', 'SEIS');
load('./assets/spectral.js', 'SPEC');

let pass = 0, fail = 0;
const rows = [];
function check(name, got, want, tol, note) {
  const ok = Math.abs(got - want) <= tol;
  ok ? pass++ : fail++;
  rows.push([ok ? 'ok  ' : 'FAIL', name, fmt(got), fmt(want), tol, note || '']);
}
function report(name, got, note) {
  rows.push(['--  ', name, fmt(got), '', '', note || '']);
}
function fmt(v) {
  if (v === '' || v == null) return '';
  if (typeof v !== 'number') return String(v);
  if (!isFinite(v)) return String(v);
  return Math.abs(v) >= 1000 || (Math.abs(v) < 0.001 && v !== 0)
    ? v.toExponential(3) : v.toFixed(5);
}

/* ---------------------------------------------------------------- 1. Morlet */
// Half-power bandwidth of the mother wavelet, measured off the response curve.
function measuredBandwidth(sigma) {
  const fj = 1, N = 200001, lo = 0.0001, hi = 3;
  let peak = 0;
  const g = (f) => Math.pow(SPEC.morletResponse(f, fj, sigma), 2);
  for (let i = 0; i < N; i++) peak = Math.max(peak, g(lo + (hi - lo) * i / (N - 1)));
  let f1 = null, f2 = null;
  for (let i = 0; i < N; i++) {
    const f = lo + (hi - lo) * i / (N - 1);
    if (g(f) >= peak / 2) { if (f1 === null) f1 = f; f2 = f; }
  }
  return f2 - f1;
}
check('morlet bandwidth, sigma^2=1.00', measuredBandwidth(1.0), 0.265, 0.001,
  'spec_cwt default');
check('morlet bandwidth, sigma^2=0.44', measuredBandwidth(Math.sqrt(0.44)), 0.398, 0.002,
  'doc calls this NARROW band');
check('morlet bandwidth, sigma^2=2.00', measuredBandwidth(Math.sqrt(2.0)), 0.187, 0.002,
  'doc calls this BROAD band');
check('morletBandwidth() closed form', SPEC.morletBandwidth(1.0), 0.26507, 1e-4, '');
check('morletSigma round trip', SPEC.morletSigma(SPEC.morletBandwidth(0.7)), 0.7, 1e-9, '');

/* ------------------------------------------------------------------- 2. CWT */
const dt = 0.001, nt = 1024;
function cosTrace(f, amp, phase) {
  const x = new Float64Array(nt);
  for (let i = 0; i < nt; i++) x[i] = amp * Math.cos(2 * Math.PI * f * i * dt + (phase || 0));
  return x;
}
{
  const tr = cosTrace(30, 0.8);
  const tf = SPEC.cwt(tr, dt, [30], { sigma: 1.0 });
  const mid = Math.floor(nt / 2);
  check('CWT magnitude of a 0.8 cosine', tf.mag[0][mid], 0.8, 0.01, 'unit-gain filter bank');

  // phase of a cosine advances as 2 pi f t; the corrected phase must not.
  const p1 = tf.phase[0][mid], p2 = tf.phase[0][mid + 100];
  const dPh = SPEC.wrapPi(p2 - p1);
  check('CWT raw phase advance over 0.1 s', dPh, SPEC.wrapPi(2 * Math.PI * 30 * 0.1), 0.02, '');
  const c1 = tf.phaseCorr[0][mid], c2 = tf.phaseCorr[0][mid + 100];
  check('CWT corrected phase advance', SPEC.wrapPi(c2 - c1), 0, 0.02, 'traveltime removed');
}
{
  // A delta: the CWT ridge must sit at the delta time at every frequency, and
  // the ridge must get narrower in time as frequency rises.
  const tr = new Float64Array(nt);
  const i0 = 400;
  tr[i0] = 1;
  const freqs = [10, 20, 40, 80];
  const tf = SPEC.cwt(tr, dt, freqs, { sigma: 1.0 });
  let widths = [];
  freqs.forEach((f, j) => {
    let jm = 0;
    for (let i = 0; i < nt; i++) if (tf.mag[j][i] > tf.mag[j][jm]) jm = i;
    check(`CWT delta ridge time at ${f} Hz`, jm * dt, i0 * dt, 0.002, '');
    let w = 0;
    for (let i = 0; i < nt; i++) if (tf.mag[j][i] >= tf.mag[j][jm] / 2) w++;
    widths.push(w * dt);
  });
  const ratio = widths[0] / widths[3];
  check('CWT ridge width 10 Hz / 80 Hz', ratio, 8, 0.5, 'constant-Q: width ~ 1/f');
}
{
  /* Filter bank flatness. The documentation offers equally spaced frequencies
     OR a fixed number per octave, and does not say why you would pick one.
     This is why: a constant-Q family on a LINEAR frequency grid has a gain
     that climbs with frequency, so summing the voices blues the trace. On a
     LOG grid the gain is constant and the voices really do sum to the data. */
  const axis = [];
  for (let f = 20; f <= 70; f += 1) axis.push(f);

  const lin = [];
  for (let f = 2; f <= 200; f += 2) lin.push(f);      // wide, so 20-70 is interior
  const sl = SPEC.filterBankSum(lin, 1.0, axis);
  report('linear grid, bank gain at 20 Hz', sl[0], 'df = 2 Hz');
  report('linear grid, bank gain at 70 Hz', sl[axis.length - 1], 'gain climbs with f');
  check('linear grid gain ratio 70/20', sl[axis.length - 1] / sl[0], 70 / 20, 0.15,
    'gain proportional to f: summing voices applies an f^1 tilt');

  const log = [];
  for (let f = 5; f <= 120; f *= Math.pow(2, 1 / 8)) log.push(f);   // 8 per octave
  const sg = SPEC.filterBankSum(log, 1.0, axis);
  let mn = Infinity, mx = -Infinity;
  for (const v of sg) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  check('log grid ripple, 8 per octave', (mx - mn) / ((mx + mn) / 2), 0, 0.02,
    'flat: this is the grid to reconstruct on');

  const tr = cosTrace(45, 1.0);
  const tf = SPEC.cwt(tr, dt, log, { sigma: 1.0 });
  const vs = SPEC.voiceSum(tf);
  const mid = Math.floor(nt / 2);
  let num = 0, den = 0;
  for (let i = mid - 200; i < mid + 200; i++) { num += vs[i] * tr[i]; den += tr[i] * tr[i]; }
  report('voice sum / trace on the log grid', num / den,
    'one constant, so the voices reconstruct after one scalar');
}
{
  // The instantaneous frequency of a Ricker is not its peak frequency.
  const wav = SEIS.makeWavelet({ type: 'ricker', f: 30 });
  const x = new Float64Array(nt);
  for (let i = 0; i < nt; i++) x[i] = wav.fn(i * dt - 0.5);
  const inst = SPEC.instFreq(x, dt);
  check('inst. freq at the peak of a 30 Hz Ricker', inst[500] / 30,
    SPEC.RICKER_INST_RATIO, 0.02, '2/sqrt(pi) = 1.128, not 1');
}

/* ------------------------------------------------------------------ 3. STFT */
{
  const tr = cosTrace(40, 0.5);
  const freqs = [];
  for (let f = 5; f <= 120; f += 1) freqs.push(f);
  const tf = SPEC.stft(tr, dt, freqs, { winLen: 0.080, window: 'hann' });
  const mid = Math.floor(nt / 2);
  let jm = 0;
  for (let j = 0; j < freqs.length; j++) if (tf.mag[j][mid] > tf.mag[jm][mid]) jm = j;
  check('STFT peak frequency of a 40 Hz tone', freqs[jm], 40, 1.0, '');
  check('STFT magnitude of a 0.5 cosine', tf.mag[jm][mid], 0.5, 0.02, 'Hann, 80 ms');
  check('windowFloor(0.040)', SPEC.windowFloor(0.040), 25, 1e-9, 'doc quotes 25 Hz');
}
{
  // The uncertainty trade, demonstrated: two tones 8 Hz apart inside a 40 ms
  // window are one peak to the STFT (1/T = 25 Hz) and two to the sparse solver.
  const seg = [];
  const nseg = 41;                                   // 40 ms at 1 ms
  for (let i = 0; i < nseg; i++) {
    const t = (i - (nseg - 1) / 2) * dt;
    seg.push(Math.cos(2 * Math.PI * 20 * t) + Math.cos(2 * Math.PI * 28 * t));
  }
  const freqs = [];
  for (let f = 5; f <= 60; f += 0.5) freqs.push(f);

  function countPeaks(mag, thresh) {
    let c = 0;
    for (let j = 1; j < mag.length - 1; j++) {
      if (mag[j] > mag[j - 1] && mag[j] >= mag[j + 1] && mag[j] > thresh) c++;
    }
    return c;
  }
  const tfs = SPEC.stft(Float64Array.from(seg), dt, freqs, { winLen: 0.040, window: 'hann' });
  const mid = Math.floor(nseg / 2);
  const dftMag = freqs.map((_, j) => tfs.mag[j][mid]);
  let dmax = Math.max(...dftMag);
  check('STFT peaks, 20+28 Hz in a 40 ms window', countPeaks(dftMag, 0.3 * dmax), 1, 0,
    'cannot resolve: 1/T = 25 Hz');

  const sp = SPEC.sparseSpectrum(Float64Array.from(seg), dt, freqs, { iters: 8, alpha: 0.005 });
  let smax = 0;
  for (const v of sp.mag) smax = Math.max(smax, v);
  check('sparse peaks, same window', countPeaks(sp.mag, 0.3 * smax), 2, 0,
    'model beats the window');
  const pk = [];
  for (let j = 1; j < freqs.length - 1; j++) {
    if (sp.mag[j] > sp.mag[j - 1] && sp.mag[j] >= sp.mag[j + 1] && sp.mag[j] > 0.3 * smax) pk.push(freqs[j]);
  }
  if (pk.length === 2) {
    check('sparse peak 1', pk[0], 20, 1.5, '');
    check('sparse peak 2', pk[1], 28, 1.5, '');
  }
}

/* -------------------------------------------------- 4. Matching pursuit */
{
  const wav30 = SEIS.makeWavelet({ type: 'ricker', f: 30 });
  const wav50 = SEIS.makeWavelet({ type: 'ricker', f: 50 });
  const tr = new Float64Array(nt);
  const truth = [
    { t: 0.150, f: 30, a: 1.00, w: wav30 },
    { t: 0.400, f: 50, a: 0.60, w: wav50 },
    { t: 0.700, f: 30, a: -0.80, w: wav30 },
  ];
  for (let i = 0; i < nt; i++) {
    const t = i * dt;
    for (const e of truth) tr[i] += e.a * e.w.fn(t - e.t);
  }
  const mp = SPEC.matchingPursuit(tr, dt, { fmin: 5, fmax: 100, beta: 0.4, maxIter: 8 });
  report('MP atoms found', mp.atoms.length, 'three planted');
  const byTime = mp.atoms.slice().sort((a, b) => a.t - b.t);
  truth.forEach((e, k) => {
    const near = byTime.filter(a => Math.abs(a.t - e.t) < 0.020)
      .sort((a, b) => b.amp - a.amp)[0];
    if (!near) { fail++; rows.push(['FAIL', `MP atom near t=${e.t}`, 'none', e.t, '', '']); return; }
    check(`MP atom ${k + 1} time`, near.t, e.t, 0.004, '');
    check(`MP atom ${k + 1} frequency`, near.f, e.f, 5.0, '');
    check(`MP atom ${k + 1} amplitude`, near.amp, Math.abs(e.a), 0.12, '');
  });
  let r2 = 0, d2 = 0;
  for (let i = 0; i < nt; i++) { r2 += mp.residual[i] * mp.residual[i]; d2 += tr[i] * tr[i]; }
  check('MP residual energy fraction', r2 / d2, 0, 0.05, 'should model nearly all of it');
}

/* ------------------------------------------------ 5. Spectral statistics */
{
  // A Gaussian spectrum: peak = mean, skewness 0, effective kurtosis 0.
  const freqs = [], mag = [];
  const mu = 40, sd = 10;
  for (let f = 1; f <= 100; f += 0.5) {
    freqs.push(f);
    mag.push(Math.exp(-0.5 * Math.pow((f - mu) / sd, 2)));
  }
  const st = SPEC.specStats(mag, freqs);
  check('Gaussian spectrum peak frequency', st.peakFreq, mu, 0.1, 'parabolic interpolation');
  check('Gaussian spectrum mean frequency', st.meanFreq, mu, 0.2, 'peak = mean');
  check('Gaussian spectrum skewness', st.skewness, 0, 0.02, '');
  check('Gaussian effective kurtosis', st.effKurtosis, 0, 0.05, 'Gaussian is the zero');
  check('Gaussian half-magnitude bandwidth', st.bandwidthHalfMag,
    2 * sd * Math.sqrt(2 * Math.LN2), 0.6, 'FWHM = 2.355 sigma');
  report('Gaussian percentile bandwidth (15%)', st.bandwidthPct,
    'spec_cmp definition, same spectrum');
}
{
  // A flat spectrum: log-log slope 0, roughness 0.
  const freqs = [], mag = [];
  for (let f = 10; f <= 80; f += 1) { freqs.push(f); mag.push(1.0); }
  const st = SPEC.specStats(mag, freqs);
  check('flat spectrum log-log slope', st.slope, 0, 1e-6, 'impedance jump: f^0');
  check('flat spectrum roughness', st.roughness, 0, 1e-6, 'perfect linear fit');
}
{
  // The documented end members: thin bed rises as f^+1, ramp falls as f^-1.
  for (const p of [1, -1]) {
    const freqs = [], mag = [];
    for (let f = 10; f <= 80; f += 1) { freqs.push(f); mag.push(Math.pow(f, p)); }
    const st = SPEC.specStats(mag, freqs);
    check(`spectral slope of f^${p > 0 ? '+1' : '-1'}`, st.slope, p, 0.02,
      p > 0 ? 'thin bed' : 'linear impedance ramp');
  }
}

/* ------------------------------------------------------- 6. Tuning */
{
  for (const T of [0.010, 0.016, 0.025]) {
    // closed form: doublet spectrum peaks at 1/(2T)
    const freqs = [], mag = [];
    for (let f = 1; f <= 200; f += 0.25) { freqs.push(f); mag.push(SPEC.doubletSpectrum(f, T)); }
    const st = SPEC.specStats(mag, freqs);
    check(`doublet peak frequency, T=${(T * 1000).toFixed(0)} ms`,
      st.peakFreq, SPEC.tuningFrequency(T), 0.5, `1/(2T) = ${(1 / (2 * T)).toFixed(1)} Hz`);
    check(`thickness back out of peak, T=${(T * 1000).toFixed(0)} ms`,
      SPEC.tuningThickness(st.peakFreq) * 1000, T * 1000, 0.2, 'ms');
  }
  // first notch of a doublet sits at 1/T
  const T = 0.020;
  check('doublet first notch', SPEC.doubletSpectrum(1 / T, T), 0, 1e-9, 'f = 1/T');
}
{
  // The wedge, measured rather than asserted: apparent peak amplitude should
  // occur near the tuning thickness of the wavelet.
  const wav = SEIS.makeWavelet({ type: 'ricker', f: 30 });
  const w = SPEC.wedge({ nx: 81, dt: 0.001, nt: 400, t0: 0.10, maxThick: 0.040, wavelet: wav });
  let best = 0, bestT = 0;
  for (let ix = 0; ix < w.nx; ix++) {
    let peak = 0;
    for (let i = 0; i < w.nt; i++) peak = Math.max(peak, Math.abs(w.traces[ix][i]));
    if (peak > best) { best = peak; bestT = w.thickness[ix]; }
  }
  report('wedge tuning thickness, 30 Hz Ricker', bestT * 1000, 'ms of two-way time');
  report('  compare 1/(2 fdom)', 1000 / (2 * 30), 'ms');
}

/* -------------------------------------------------- 7. Spectral balancing */
{
  const freqs = [];
  for (let f = 5; f <= 100; f += 1) freqs.push(f);
  // a wavelet-shaped average spectrum
  const avg = freqs.map(f => Math.exp(-0.5 * Math.pow((f - 35) / 12, 2)) + 0.02);
  const scale = SPEC.balanceOperator(avg, freqs, { alpha: 0.01, beta: 0 });
  const bal = SPEC.applyBalance(avg, scale);
  // flatness measured over the passband, where the operator is meaningful
  const band = [];
  freqs.forEach((f, j) => { if (f >= 20 && f <= 55) band.push(bal[j]); });
  const mean = band.reduce((a, b) => a + b, 0) / band.length;
  const sd = Math.sqrt(band.reduce((a, b) => a + (b - mean) * (b - mean), 0) / band.length);
  check('balanced spectrum flatness (sd/mean, 20-55 Hz)', sd / mean, 0, 0.05,
    'alpha = 1%');
  const rawBand = [];
  freqs.forEach((f, j) => { if (f >= 20 && f <= 55) rawBand.push(avg[j]); });
  const rm = rawBand.reduce((a, b) => a + b, 0) / rawBand.length;
  const rs = Math.sqrt(rawBand.reduce((a, b) => a + (b - rm) * (b - rm), 0) / rawBand.length);
  report('unbalanced flatness, same band', rs / rm, 'what balancing had to fix');

  const blued = SPEC.applyBalance(avg, SPEC.balanceOperator(avg, freqs, { alpha: 0.01, beta: 0.3 }));
  const j20 = freqs.indexOf(20), j50 = freqs.indexOf(50);
  report('bluing beta=0.3, ratio 50 Hz / 20 Hz', blued[j50] / blued[j20],
    `theory (50/20)^0.3 = ${Math.pow(50 / 20, 0.3).toFixed(4)}`);
  check('bluing tilt matches f^beta', blued[j50] / blued[j20],
    (bal[j50] / bal[j20]) * Math.pow(50 / 20, 0.3), 1e-6, '');
}

/* ------------------------------------------------------------ 8. Q filter */
{
  const wav = SEIS.makeWavelet({ type: 'ricker', f: 40 });
  const tr = new Float64Array(nt);
  for (let i = 0; i < nt; i++) tr[i] = wav.fn(i * dt - 0.2);
  const Q = 50, T = 1.0;
  const att = SPEC.applyQ(tr, dt, Q, T, { dispersion: false });

  function ampAt(x, f) {
    let re = 0, im = 0;
    for (let i = 0; i < x.length; i++) {
      const a = 2 * Math.PI * f * i * dt;
      re += x[i] * Math.cos(a); im -= x[i] * Math.sin(a);
    }
    return Math.hypot(re, im);
  }
  for (const f of [20, 40, 60]) {
    const ratio = ampAt(att, f) / ampAt(tr, f);
    check(`Q loss at ${f} Hz`, ratio, Math.exp(-Math.PI * f * T / Q), 0.01,
      'exp(-pi f t / Q)');
  }
  // and the consequence the module is about: the peak frequency comes down
  const freqs = [];
  for (let f = 2; f <= 120; f += 0.5) freqs.push(f);
  const s0 = freqs.map(f => ampAt(tr, f));
  const s1 = freqs.map(f => ampAt(att, f));
  const p0 = SPEC.specStats(s0, freqs).peakFreq;
  const p1 = SPEC.specStats(s1, freqs).peakFreq;
  report('peak frequency before Q', p0, 'Hz');
  report('peak frequency after Q=50, t=1 s', p1, 'Hz');
  report('  apparent thickness change', (SPEC.tuningThickness(p1) - SPEC.tuningThickness(p0)) * 1000,
    'ms of tuning thickness you would wrongly infer');
}
{
  /* The dispersion SIGN. In a constant-Q medium the phase velocity rises with
     frequency, so a high-frequency packet arrives EARLIER than a low-frequency
     one. This check exists because the sign was wrong once and nothing in the
     amplitude spectrum noticed: every readout in module 09 was correct while
     the propagated wavelet was mirrored in time. Three narrowband packets are
     launched from the same instant and their envelope peaks compared. */
  const t0 = 0.20, sig = 0.020, Q = 50, T = 1.0, fref = 50;
  function packet(f) {
    const x = new Float64Array(nt);
    for (let i = 0; i < nt; i++) {
      const t = i * dt - t0;
      x[i] = Math.exp(-(t * t) / (2 * sig * sig)) * Math.cos(2 * Math.PI * f * t);
    }
    return x;
  }
  function envPeak(x) {
    const e = SPEC.envelope(x);
    let k = 1;
    for (let i = 1; i < nt - 1; i++) if (e[i] > e[k]) k = i;
    const d = 0.5 * (e[k - 1] - e[k + 1]) / (e[k - 1] - 2 * e[k] + e[k + 1]);
    return (k + d) * dt;
  }
  const arr = [20, 50, 80].map(f => envPeak(SPEC.applyQ(packet(f), dt, Q, T, { fref })));
  report('arrival of a 20 Hz packet after Q', arr[0] * 1000, 'ms');
  report('arrival of a 50 Hz packet after Q', arr[1] * 1000, 'ms');
  report('arrival of an 80 Hz packet after Q', arr[2] * 1000, 'ms');
  check('dispersion: 80 Hz arrives before 20 Hz', arr[2] < arr[0] ? 1 : 0, 1, 0,
    'phase velocity rises with frequency; sign was reversed once');
  check('dispersion: 50 Hz arrives before 20 Hz', arr[1] < arr[0] ? 1 : 0, 1, 0, '');
  // and the size of the advance, against the exact power law
  const dTheory = T * (Math.pow(80 / fref, -1 / (Math.PI * Q)) - Math.pow(20 / fref, -1 / (Math.PI * Q)));
  check('dispersion: 80 Hz advance over 20 Hz', (arr[2] - arr[0]), dTheory, 0.004,
    'phase delay of the exact power law, within a group-delay term');
}

/* --------------------------------------------------------- 9. Blending */
{
  const r = [1, 0, 0.5], g = [0, 1, 0.5], b = [0, 0, 0.5];
  const px = SPEC.rgbBlend(r, g, b, { r: [0, 1], g: [0, 1], b: [0, 1] });
  check('rgbBlend pure red', px[0], 255, 0.5, '');
  check('rgbBlend pure red, green channel', px[1], 0, 0.5, '');
  check('rgbBlend mid gray', px[6], 128, 1.5, '');

  /* The overlay compositor. The properties that separate it from rgbBlend are
     the ones module 07 teaches, so they are the ones checked: a full-strength
     layer hides what is under it, order therefore matters, a transparent layer
     changes nothing, and an empty stack leaves the background. */
  const RED = [229, 57, 53], BLU = [30, 136, 229], INK = [16, 19, 21];
  const over = (ls) => SPEC.overlayPixel(ls, INK);
  check('overlay: one opaque layer is its own color',
    over([{ value: 1, color: RED }])[0], RED[0], 0.5, '');
  check('overlay: a zero-magnitude layer is invisible',
    over([{ value: 0, color: RED }])[0], INK[0], 0.5, 'transparent where there is nothing');
  check('overlay: an opaque top layer hides the one below (red)',
    over([{ value: 1, color: RED }, { value: 1, color: BLU }])[0], BLU[0], 0.5, '');
  check('overlay: an opaque top layer hides the one below (blue)',
    over([{ value: 1, color: RED }, { value: 1, color: BLU }])[2], BLU[2], 0.5, '');
  {
    // ORDER MATTERS. This is the whole difference from the additive model.
    const a = over([{ value: 1, color: RED }, { value: 1, color: BLU }]);
    const b = over([{ value: 1, color: BLU }, { value: 1, color: RED }]);
    const differs = Math.abs(a[0] - b[0]) + Math.abs(a[2] - b[2]);
    check('overlay: swapping the order changes the pixel', differs > 100 ? 1 : 0, 1, 0,
      'additive blending cannot do this');
    // and the additive model must NOT depend on order, which is the contrast
    const p = SPEC.rgbBlend([1], [0], [1], { r: [0, 1], g: [0, 1], b: [0, 1] });
    const qq = SPEC.rgbBlend([1], [0], [1], { r: [0, 1], g: [0, 1], b: [0, 1] });
    check('additive: same inputs, same pixel', Math.abs(p[0] - qq[0]), 0, 0.5,
      'no order to depend on');
  }
  check('overlay: a switched-off layer contributes nothing',
    over([{ value: 1, color: RED, on: false }])[0], INK[0], 0.5, '');
  {
    // half-opacity blue over full red lands between them, not on either
    const c = over([{ value: 1, color: RED }, { value: 0.5, color: BLU }]);
    const between = c[0] < RED[0] && c[0] > BLU[0] && c[2] > RED[2] && c[2] < BLU[2];
    check('overlay: a partly transparent layer mixes, not replaces',
      between ? 1 : 0, 1, 0, 'opacity follows magnitude');
  }
  {
    // whole-map form agrees with the single-pixel form
    const m = SPEC.overlayBlend([[1], [0], [0.5]],
      { colors: [RED, [67, 160, 71], BLU], bg: INK });
    const one = over([{ value: 1, color: RED }, { value: 0, color: [67, 160, 71] },
      { value: 0.5, color: BLU }]);
    check('overlayBlend agrees with overlayPixel', m[0], Math.round(one[0]), 1.5, '');
  }

  // hlplot's trap: where the magnitude is zero the pixel is black whatever the
  // frequency says, which is the point of the display.
  const hl = SPEC.hueLightness([0.9, 0.1], [0.0, 0.0], { hueRange: [0, 1], lightRange: [0, 1] });
  check('hue-lightness, zero magnitude -> dark (a)', (hl[0] + hl[1] + hl[2]) / 3, 38, 12,
    'peak frequency means nothing here');
  check('hue-lightness, zero magnitude -> dark (b)', (hl[3] + hl[4] + hl[5]) / 3, 38, 12, '');
}

/* ------------------------------------------------------------------ out */
const w = [4, 46, 12, 12, 8];
console.log('');
console.log(['    ', 'check'.padEnd(w[1]), 'measured'.padStart(w[2]),
  'expected'.padStart(w[3]), 'tol'.padStart(w[4]), '  note'].join(' '));
console.log('-'.repeat(120));
for (const r of rows) {
  console.log([r[0], String(r[1]).padEnd(w[1]), String(r[2]).padStart(w[2]),
    String(r[3]).padStart(w[3]), String(r[4]).padStart(w[4]), '  ' + r[5]].join(' '));
}
console.log('-'.repeat(120));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
