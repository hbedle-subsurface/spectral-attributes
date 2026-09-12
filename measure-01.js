/* Numbers for module 01. Nothing goes in the prose that is not printed here. */
const fs = require('fs'), vm = require('vm');
function load(p, n) { vm.runInThisContext(fs.readFileSync(p, 'utf8') + `\nglobalThis.${n}=${n};`, { filename: p }); }
load('./assets/seismic.js', 'SEIS');
load('./assets/spectral.js', 'SPEC');

const DT = 0.0002;

function sample(wav, span) {
  const n = Math.ceil(span / DT);
  const t = [], v = [];
  for (let i = -n; i <= n; i++) { t.push(i * DT); v.push(wav.fn(i * DT)); }
  return { t, v, i0: n };
}
// main lobe half-width: t of the first zero crossing after the center
function lobe(wav) {
  const s = sample(wav, 0.4);
  const c = s.i0;
  let z = null;
  for (let i = c; i < s.v.length - 1; i++) {
    if (s.v[i] >= 0 && s.v[i + 1] < 0) { z = s.t[i]; break; }
  }
  // largest excursion of the opposite sign beyond that crossing
  let side = 0;
  if (z !== null) {
    for (let i = c; i < s.v.length; i++) if (s.t[i] > z) side = Math.min(side, s.v[i]);
  }
  // trailing sidelobe after the first trough: the second positive bump
  let second = 0, seenTrough = false;
  for (let i = c; i < s.v.length - 1; i++) {
    if (s.v[i] < s.v[i - 1] && s.v[i] < s.v[i + 1]) seenTrough = true;
    if (seenTrough && s.v[i] > 0) second = Math.max(second, s.v[i]);
  }
  // effective length: last time |v| exceeds 1% of peak
  let len = 0;
  for (let i = 0; i < s.v.length; i++) if (Math.abs(s.v[i]) > 0.01) len = Math.max(len, Math.abs(s.t[i]));
  return { firstZero: z, trough: side, secondLobe: second, length01: len };
}
function spec(wav, fmax) {
  const nf = 1200;
  const pts = SEIS.spectrum(wav, DT, nf, fmax || 200);   // [{f, a}], a normalized
  const freqs = pts.map(p => p.f);
  const mag = pts.map(p => p.a);
  return { freqs, mag, stats: SPEC.specStats(mag, freqs) };
}
function row(label, o) {
  console.log(label.padEnd(34) + Object.entries(o)
    .map(([k, v]) => `${k}=${typeof v === 'number' ? (Math.abs(v) < 1 ? v.toFixed(3) : v.toFixed(1)) : v}`)
    .join('  '));
}

console.log('\n== RICKER: peak frequency is not the only frequency ==');
for (const f of [15, 30, 60]) {
  const w = SEIS.makeWavelet({ type: 'ricker', f });
  const s = spec(w, 250), L = lobe(w);
  row(`ricker ${f} Hz`, {
    peak_Hz: s.stats.peakFreq, mean_Hz: s.stats.meanFreq,
    bw_Hz: s.stats.bandwidthHalfMag,
    mean_over_peak: s.stats.meanFreq / f,
    halfPeriod_ms: 1000 * L.firstZero,
    trough: L.trough, len1pct_ms: 1000 * L.length01,
  });
}

console.log('\n== ORMSBY: what widening the passband does ==');
const bands = [
  [5, 10, 20, 25], [5, 10, 30, 35], [5, 10, 40, 50],
  [5, 10, 60, 70], [5, 10, 80, 90], [5, 10, 100, 110],
];
for (const b of bands) {
  const w = SEIS.makeWavelet({ type: 'ormsby', f1: b[0], f2: b[1], f3: b[2], f4: b[3] });
  const s = spec(w, 250), L = lobe(w);
  row(`ormsby ${b.join('-')}`, {
    peak_Hz: s.stats.peakFreq, bw_Hz: s.stats.bandwidthHalfMag,
    octaves: Math.log2(((b[2] + b[3]) / 2) / ((b[0] + b[1]) / 2)),
    halfPeriod_ms: 1000 * L.firstZero,
    trough: L.trough, secondLobe: L.secondLobe,
  });
}

console.log('\n== OCTAVES: the same 10 Hz, added at two ends ==');
function ormsby(a, b, c, d) { return SEIS.makeWavelet({ type: 'ormsby', f1: a, f2: b, f3: c, f4: d }); }
const base = ormsby(10, 15, 40, 50);
const bl = lobe(base), bs = spec(base, 250);
row('base 10-15-40-50', { halfPeriod_ms: 1000 * bl.firstZero, bw_Hz: bs.stats.bandwidthHalfMag, octaves: Math.log2(45 / 12.5) });
const hi = ormsby(10, 15, 50, 60);
const hl = lobe(hi), hs = spec(hi, 250);
row('+10 Hz on top 10-15-50-60', {
  halfPeriod_ms: 1000 * hl.firstZero, bw_Hz: hs.stats.bandwidthHalfMag,
  octaves: Math.log2(55 / 12.5),
  lobe_change_pct: 100 * (hl.firstZero - bl.firstZero) / bl.firstZero,
});
const lo = ormsby(3, 5, 40, 50);
const ll = lobe(lo), ls = spec(lo, 250);
row('-10 Hz at base 3-5-40-50', {
  halfPeriod_ms: 1000 * ll.firstZero, bw_Hz: ls.stats.bandwidthHalfMag,
  octaves: Math.log2(45 / 4),
  lobe_change_pct: 100 * (ll.firstZero - bl.firstZero) / bl.firstZero,
});

console.log('\n== A TRACE IS A SUM OF COSINES: partial reconstruction ==');
{
  const w = SEIS.makeWavelet({ type: 'ormsby', f1: 5, f2: 10, f3: 60, f4: 70 });
  const nt = 512, dt = 0.001;
  const tr = new Float64Array(nt);
  for (let i = 0; i < nt; i++) tr[i] = w.fn((i - nt / 2) * dt);
  // Fourier components, added in order of decreasing amplitude
  const n = 512;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < nt; i++) re[i] = tr[i];
  SEIS.fft(re, im, false);
  const comps = [];
  for (let k = 1; k < n / 2; k++) comps.push({ k, a: Math.hypot(re[k], im[k]) });
  comps.sort((x, y) => y.a - x.a);
  let energy = 0;
  for (const c of comps) energy += 2 * c.a * c.a;
  let acc = 0;
  const marks = [1, 3, 5, 10, 20, 40];
  for (const m of marks) {
    acc = 0;
    for (let j = 0; j < m; j++) acc += 2 * comps[j].a * comps[j].a;
    row(`${m} strongest components`, { pct_of_energy: 100 * acc / energy, at_Hz: comps[m - 1].k / (n * dt) });
  }
}

console.log('\n== NYQUIST ==');
for (const dt of [0.001, 0.002, 0.004, 0.008]) {
  row(`sample interval ${(dt * 1000).toFixed(0)} ms`, { nyquist_Hz: 1 / (2 * dt) });
}
{
  // a pure tone sampled too coarsely comes back as a different tone
  for (const f of [60, 100, 150, 200]) {
    const dt = 0.004, n = 256;
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos(2 * Math.PI * f * i * dt);
    SEIS.fft(re, im, false);
    let jm = 1, best = 0;
    for (let k = 1; k < n / 2; k++) {
      const a = Math.hypot(re[k], im[k]);
      if (a > best) { best = a; jm = k; }
    }
    row(`${f} Hz tone at 4 ms`, {
      nyquist_Hz: 125, comes_back_as_Hz: jm / (n * dt),
    });
  }
}
console.log('');

console.log('== OCTAVES, NOT HERTZ: same bandwidth in Hz, different octaves ==');
{
  // Both of these are ~32 Hz wide. One spans nearly two octaves, the other
  // barely half of one. Bandwidth in Hz says they are the same; the wavelets
  // are nothing alike.
  for (const b of [[10, 15, 40, 45], [30, 35, 60, 65], [60, 65, 90, 95]]) {
    const w = ormsby(b[0], b[1], b[2], b[3]);
    const L = lobe(w), S2 = spec(w, 250);
    row(`ormsby ${b.join('-')}`, {
      bw_Hz: S2.stats.bandwidthHalfMag,
      octaves: Math.log2(((b[2] + b[3]) / 2) / ((b[0] + b[1]) / 2)),
      halfPeriod_ms: 1000 * L.firstZero,
      secondLobe: L.secondLobe,
      len1pct_ms: 1000 * L.length01,
    });
  }
}

console.log('\n== THE COST OF A SHARP SPECTRAL EDGE ==');
{
  // same passband, different taper width. Sharp corners ring.
  for (const b of [[5, 10, 60, 70], [8, 10, 60, 62], [9.5, 10, 60, 60.5]]) {
    const w = ormsby(b[0], b[1], b[2], b[3]);
    const L = lobe(w);
    row(`ormsby ${b.join('-')}`, {
      taper_Hz: b[3] - b[2],
      halfPeriod_ms: 1000 * L.firstZero,
      secondLobe: L.secondLobe,
      len1pct_ms: 1000 * L.length01,
    });
  }
}
console.log('');
