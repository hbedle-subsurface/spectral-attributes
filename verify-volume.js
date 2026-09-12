/* ===========================================================================
   verify-volume.js — known-answer checks for assets/volume.js
   Run: node verify-volume.js

   Same discipline as verify-spectral.js. Every claim a module would make about
   this volume is checked here first, against a closed form where one exists
   and against the truth maps where one does not. The numbers printed here are
   the numbers allowed to appear in module prose.
   =========================================================================== */

const fs = require('fs');
const vm = require('vm');
function load(path, name) {
  const src = fs.readFileSync(path, 'utf8') + `\nglobalThis.${name} = ${name};`;
  vm.runInThisContext(src, { filename: path });
}
load('./assets/seismic.js', 'SEIS');
load('./assets/spectral.js', 'SPEC');
load('./assets/strata.js', 'STRATA');
load('./assets/volume.js', 'VOL');

let pass = 0, fail = 0;
const rows = [];
function check(name, got, want, tol, note) {
  const ok = Math.abs(got - want) <= tol;
  ok ? pass++ : fail++;
  rows.push([ok ? 'ok  ' : 'FAIL', name, fmt(got), fmt(want), fmt(tol), note || '']);
}
function ok(name, cond, note) {
  cond ? pass++ : fail++;
  rows.push([cond ? 'ok  ' : 'FAIL', name, cond ? 'true' : 'false', 'true', '', note || '']);
}
function report(name, got, note) { rows.push(['--  ', name, fmt(got), '', '', note || '']); }
function fmt(v) {
  if (v === '' || v == null) return '';
  if (typeof v !== 'number') return String(v);
  if (!isFinite(v)) return String(v);
  return Math.abs(v) >= 10000 || (Math.abs(v) < 0.0001 && v !== 0)
    ? v.toExponential(3) : v.toFixed(4);
}

/* --------------------------------------------------------- 1. build & cost */

const tA = Date.now();
const vol = VOL.build({});
const buildMs = Date.now() - tA;

report('build time, ms', buildMs, `${vol.nx}x${vol.ny}x${vol.nt}`);
report('samples, millions', vol.nx * vol.ny * vol.nt / 1e6);
report('memory, MB', VOL.bytes(vol) / 1048576, 'Float32');
ok('build under 3 s', buildMs < 3000, 'has to redraw on a slider');

/* determinism */
const volB = VOL.build({});
let maxDiff = 0;
for (let i = 0; i < vol.data.length; i += 997) {
  maxDiff = Math.max(maxDiff, Math.abs(vol.data[i] - volB.data[i]));
}
check('same seed, same volume', maxDiff, 0, 0, 'reproducible from the seed');

/* ------------------------------------------- 2. reflection coefficients */

const R = VOL.ROCKS;
function rc(a, b) {
  const x = R[a].v * R[a].d, y = R[b].v * R[b].d;
  return (y - x) / (y + x);
}
check('RC shale over gas sand', vol.rc.gasTop, rc('shale', 'gasSand'), 1e-9, 'the bright spot');
check('RC gas over wet sand', vol.rc.flatSpot, rc('gasSand', 'wetSand'), 1e-9, 'the flat spot');
check('RC shale over coal', vol.rc.coalInShale, rc('shaleDeep', 'coal'), 1e-9);
ok('gas top is negative', vol.rc.gasTop < 0, 'impedance falls into gas');
ok('flat spot is positive', vol.rc.flatSpot > 0, 'impedance rises into water');
report('gas top RC', vol.rc.gasTop);
report('flat spot RC', vol.rc.flatSpot);
report('channel fill RC', vol.rc.channel);
report('tight sand in shale RC', vol.rc.tightSandInShale, 'weaker than the bedding');

/* -------------------------------------------------- 3. truth maps exist */

function mapStats(m) {
  let mx = 0, n = 0, s = 0;
  for (let i = 0; i < m.length; i++) { if (m[i] > 0) { n++; s += m[i]; } mx = Math.max(mx, m[i]); }
  return { max: mx * 1000, mean: (s / (n || 1)) * 1000, frac: n / m.length };
}
const cs = mapStats(vol.truth.channel);
const ws = mapStats(vol.truth.wedge);
const gs = mapStats(vol.truth.gas);
report('channel max fill, ms', cs.max);
report('channel area, % of survey', cs.frac * 100);
report('sheet sand max, ms', ws.max);
report('gas column max, ms', gs.max);
report('gas area, % of survey', gs.frac * 100);
check('channel fill reaches the set value', cs.max, vol.opt.channelFill, 0.6);
check('sheet sand reaches the set value', ws.max, vol.opt.wedgeMax, 0.6);
ok('sheet sand pinches out', ws.frac < 0.95, 'a wedge needs a zero end');
ok('gas is a closure, not the survey', gs.frac > 0.02 && gs.frac < 0.30,
  'a four-way trap, not wherever the section happens to rise');

/* the younger channel erodes the older where they cross */
let crossed = 0;
for (let i = 0; i < vol.truth.channel1.length; i++) {
  if (vol.truth.channel2[i] > 0.004 && vol.truth.channel1[i] === 0) crossed++;
}
ok('younger channel cuts out the older', crossed > 40, `${crossed} bins`);

/* --------------------------------------------- 4. the flat spot is flat */

let gwcMin = 1e9, gwcMax = -1e9, resMin = 1e9, resMax = -1e9;
for (let i = 0; i < vol.horizons.gwc.length; i++) {
  if (vol.truth.gas[i] > 0.002) {
    gwcMin = Math.min(gwcMin, vol.horizons.gwc[i]);
    gwcMax = Math.max(gwcMax, vol.horizons.gwc[i]);
    resMin = Math.min(resMin, vol.horizons.reservoir[i]);
    resMax = Math.max(resMax, vol.horizons.reservoir[i]);
  }
}
report('top reservoir relief in gas, ms', (resMax - resMin) * 1000);
report('contact relief in gas, ms', (gwcMax - gwcMin) * 1000);
ok('contact is flatter than the structure',
  (gwcMax - gwcMin) < 0.35 * (resMax - resMin), 'a flat spot cuts across dip');

/* ------------------------------------ 5. attenuation: frequency vs depth */

function peakFreqAt(v, ix, iy, tCen, win) {
  const tr = VOL.trace(v, ix, iy);
  const hw = Math.round((win / 2) / v.dt);
  const i0 = Math.round((tCen - v.t0) / v.dt);
  const seg = [];
  for (let k = i0 - hw; k <= i0 + hw; k++) {
    const x = (k - (i0 - hw)) / (2 * hw);
    seg.push((k >= 0 && k < v.nt ? tr[k] : 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * x)));
  }
  let best = 0, bestF = 0;
  for (let f = 4; f <= 100; f += 0.25) {
    let re = 0, im = 0;
    for (let k = 0; k < seg.length; k++) {
      const t = k * v.dt;
      re += seg[k] * Math.cos(2 * Math.PI * f * t);
      im -= seg[k] * Math.sin(2 * Math.PI * f * t);
    }
    const a = Math.hypot(re, im);
    if (a > best) { best = a; bestF = f; }
  }
  return bestF;
}

/* Measured on a volume carrying only background bedding, so the change with
   depth is the wavelet rather than the local geology. Centroid rather than
   peak, averaged over many traces, because a single peak pick off one trace
   is dominated by whichever bed pair it happened to window. */
function centroidLevel(v, tCen, win, step) {
  let sum = 0, n = 0;
  for (let ix = 4; ix < v.nx; ix += (step || 7)) {
    for (let iy = 4; iy < v.ny; iy += (step || 7)) {
      sum += centroidAt(v, ix, iy, tCen, win); n++;
    }
  }
  return sum / n;
}
function centroidAt(v, ix, iy, tCen, win) {
  const tr = VOL.trace(v, ix, iy);
  const hw = Math.round((win / 2) / v.dt);
  const i0 = Math.round((tCen - v.t0) / v.dt);
  const seg = [];
  for (let k = i0 - hw; k <= i0 + hw; k++) {
    const x = (k - (i0 - hw)) / (2 * hw);
    seg.push((k >= 0 && k < v.nt ? tr[k] : 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * x)));
  }
  let num = 0, den = 0;
  for (let f = 4; f <= 110; f += 0.5) {
    let re = 0, im = 0;
    for (let k = 0; k < seg.length; k++) {
      const t = k * v.dt;
      re += seg[k] * Math.cos(2 * Math.PI * f * t);
      im -= seg[k] * Math.sin(2 * Math.PI * f * t);
    }
    const a = Math.hypot(re, im);
    num += f * a; den += a;
  }
  return den > 0 ? num / den : 0;
}

const bedsOnly = VOL.build({ channels: false, wedge: false, gas: false, fault: false, structure: false });
const bedsFlat = VOL.build({ channels: false, wedge: false, gas: false, fault: false, structure: false, attenuation: false });
const cShallow = centroidLevel(bedsOnly, 0.50, 0.20);
const cDeep = centroidLevel(bedsOnly, 1.65, 0.20);
const cShallowNoQ = centroidLevel(bedsFlat, 0.50, 0.20);
const cDeepNoQ = centroidLevel(bedsFlat, 1.65, 0.20);
report('centroid at 0.50 s', cShallow, 'bedding only');
report('centroid at 1.65 s', cDeep, 'same volume');
report('centroid at 0.50 s, no Q', cShallowNoQ);
report('centroid at 1.65 s, no Q', cDeepNoQ);
ok('frequency falls with depth', cDeep < cShallow - 2.0,
  'the earth is a low-pass filter, which the set otherwise only asserts');
ok('it is attenuation that does it', Math.abs(cDeepNoQ - cShallowNoQ) < 2.0,
  'switch Q off and the depth trend goes');
report('frequency lost over 1.15 s, Hz', cShallow - cDeep);

/* A reference trace off the structure, off the channels and off the fault. */
const ixOff = 10, iyOff = 84;

function peakFreqAt(v, ix, iy, tCen, win) {
  const tr = VOL.trace(v, ix, iy);
  const hw = Math.round((win / 2) / v.dt);
  const i0 = Math.round((tCen - v.t0) / v.dt);
  const seg = [];
  for (let k = i0 - hw; k <= i0 + hw; k++) {
    const x = (k - (i0 - hw)) / (2 * hw);
    seg.push((k >= 0 && k < v.nt ? tr[k] : 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * x)));
  }
  let best = 0, bestF = 0;
  for (let f = 4; f <= 100; f += 0.25) {
    let re = 0, im = 0;
    for (let k = 0; k < seg.length; k++) {
      const t = k * v.dt;
      re += seg[k] * Math.cos(2 * Math.PI * f * t);
      im -= seg[k] * Math.sin(2 * Math.PI * f * t);
    }
    const a = Math.hypot(re, im);
    if (a > best) { best = a; bestF = f; }
  }
  return bestF;
}

/* the shadow: same time level, on and off the gas */
let ixGas = 0, iyGas = 0, best = 0;
for (let ix = 0; ix < vol.nx; ix++) {
  for (let iy = 0; iy < vol.ny; iy++) {
    const g = vol.truth.gas[ix * vol.ny + iy];
    if (g > best) { best = g; ixGas = ix; iyGas = iy; }
  }
}
const tBelow = 1.30;
const fUnderGas = peakFreqAt(vol, ixGas, iyGas, tBelow, 0.14);
const fUnderWet = peakFreqAt(vol, ixOff, iyOff, tBelow, 0.14);
report('gas column at the test trace, ms', best * 1000);
report('peak frequency 1.30 s under gas', fUnderGas);
report('peak frequency 1.30 s off gas', fUnderWet);
ok('a shadow exists beneath the gas', fUnderGas < fUnderWet - 0.5,
  'module 09 needs this to be a measurement, not a claim');
report('shadow strength, Hz', fUnderWet - fUnderGas);

/* t* is monotonic downward and larger through the gas */
report('largest t* in the volume, s', vol.tstarMax);
report('t* at the coal, under gas, s', vol.truth.tstarDeep[ixGas * vol.ny + iyGas]);
report('t* at the coal, off gas, s', vol.truth.tstarDeep[ixOff * vol.ny + iyOff]);
ok('t* below the reservoir is larger in gas',
  vol.truth.tstarDeep[ixGas * vol.ny + iyGas] > vol.truth.tstarDeep[ixOff * vol.ny + iyOff],
  'the gas column is what casts the shadow');
check('t* at the reservoir is the same either side',
  vol.truth.tstarRes[ixGas * vol.ny + iyGas], vol.truth.tstarRes[ixOff * vol.ny + iyOff], 0.0015,
  'nothing has been crossed yet at that level');

/* --------------------------------- 6. tuning on the sheet sand, in map view */

/* On a clean wedge with no bedding, no structure and no attenuation, so the
   answer is the closed-form one and any departure is the code. */
const clean = VOL.build({
  background: false, structure: false, fault: false,
  channels: false, gas: false, attenuation: false, dispersion: false
});
const wedgeAmp = VOL.horizonSlice(clean, clean.horizons.wedge, 0.010, 'peak', 0.060);
const binSum = {}, binN = {};
for (let i = 0; i < wedgeAmp.length; i++) {
  const T = clean.truth.wedge[i] * 1000;
  if (T < 1.5) continue;
  const b = Math.round(T);
  binSum[b] = (binSum[b] || 0) + Math.abs(wedgeAmp[i]);
  binN[b] = (binN[b] || 0) + 1;
}
let ampBest = 0, thkAtBest = 0;
Object.keys(binSum).forEach(b => {
  const a = binSum[b] / binN[b];
  if (a > ampBest) { ampBest = a; thkAtBest = +b; }
});
report('measured amplitude tuning thickness, ms', thkAtBest);
report('1/(2.6 f) for a 30 Hz Ricker, ms', 1000 / (2.6 * 30));
report('1/(2 f), the spectral tuning thickness, ms', 1000 / (2 * 30));
check('amplitude tuning near 1/(2.6 f)', thkAtBest, 1000 / (2.6 * 30), 1.6,
  'Kallweit and Wood; module 04 measures 13.0 ms for this wavelet');

/* metres, using the bed's own velocity */
report('16.7 ms as sand, m', VOL.thicknessInMetres(16.7, 'sand'));
report('16.7 ms as limestone, m', VOL.thicknessInMetres(16.7, 'limestone'));
report('16.7 ms as coal, m', VOL.thicknessInMetres(16.7, 'coal'));

/* --------------------------------------------- 7. slices and flattening */

const il = VOL.inline(vol, 40);
const xl = VOL.crossline(vol, 40);
check('inline size', il.data.length, vol.ny * vol.nt, 0);
check('crossline size', xl.data.length, vol.nx * vol.nt, 0);

const ts = VOL.timeSlice(vol, 0.95);
check('time slice size', ts.length, vol.nx * vol.ny, 0);

const flat = VOL.flatten(vol, vol.horizons.marker);
function reliefOfPickedMarker(v, horizon) {
  /* strongest trough-to-peak excursion near the marker, trace by trace */
  let lo = 1e9, hi = -1e9;
  for (let ix = 0; ix < v.nx; ix += 4) {
    for (let iy = 0; iy < v.ny; iy += 4) {
      const tr = VOL.trace(v, ix, iy);
      const c = Math.round((horizon - v.t0) / v.dt);
      let bi = c, ba = 0;
      for (let k = c - 12; k <= c + 12; k++) {
        if (k < 0 || k >= v.nt) continue;
        if (Math.abs(tr[k]) > ba) { ba = Math.abs(tr[k]); bi = k; }
      }
      lo = Math.min(lo, bi); hi = Math.max(hi, bi);
    }
  }
  return (hi - lo) * v.dt * 1000;
}
const reliefBefore = reliefOfPickedMarker(vol, VOL.mean(vol.horizons.marker));
const reliefAfter = reliefOfPickedMarker(flat, flat.flattenedOn);
report('marker relief before flattening, ms', reliefBefore);
report('marker relief after flattening, ms', reliefAfter);
ok('flattening removes the structure', reliefAfter < 0.35 * reliefBefore + 4,
  'the step every real spectral workflow starts with');

const slab = VOL.stratalSlab(vol, vol.horizons.channel, vol.horizons.wedge, 5);
check('stratal slab slices', slab.length, 5, 0);
check('slab slice size', slab[0].amp.length, vol.nx * vol.ny, 0);

const win = VOL.windowOn(vol, vol.horizons.channel, -0.040, 0.080);
check('window length, samples', win.nt, 20, 0);
check('window volume size', win.data.length, vol.nx * vol.ny * 20, 0);

/* --------------------------------- 8. the channel is visible where it should be */

const chanAmp = VOL.horizonSlice(vol, vol.horizons.channel, 0.017, 'rms', 0.040);
let onSum = 0, onN = 0, offSum = 0, offN = 0;
for (let i = 0; i < chanAmp.length; i++) {
  if (vol.truth.channel[i] > 0.012) { onSum += Math.abs(chanAmp[i]); onN++; }
  else if (vol.truth.channel[i] === 0) { offSum += Math.abs(chanAmp[i]); offN++; }
}
const contrast = (onSum / onN) / (offSum / offN);
report('channel amplitude vs background', contrast);
ok('the channel stands above the bedding', contrast > 3.0,
  'if it does not, the model is not teaching anything');

/* --------------------------------------------- 9. options actually do things */

const tight = VOL.build({ channelRock: 'sand' });
const tightAmp = VOL.horizonSlice(tight, tight.horizons.channel, 0.017, 'rms', 0.040);
let tOn = 0, tOnN = 0, tOff = 0, tOffN = 0;
for (let i = 0; i < tightAmp.length; i++) {
  if (tight.truth.channel[i] > 0.012) { tOn += Math.abs(tightAmp[i]); tOnN++; }
  else if (tight.truth.channel[i] === 0) { tOff += Math.abs(tightAmp[i]); tOffN++; }
}
report('tight-sand channel vs background', (tOn / tOnN) / (tOff / tOffN));
report('tight sand RC', tight.rc.channel);
const tightNoBeds = VOL.build({ channelRock: 'sand', background: false });
const tnbAmp = VOL.horizonSlice(tightNoBeds, tightNoBeds.horizons.channel, 0.017, 'rms', 0.040);
let nOn = 0, nOnN = 0, nOff = 0, nOffN = 0;
for (let i = 0; i < tnbAmp.length; i++) {
  if (tightNoBeds.truth.channel[i] > 0.012) { nOn += Math.abs(tnbAmp[i]); nOnN++; }
  else if (tightNoBeds.truth.channel[i] === 0) { nOff += Math.abs(tnbAmp[i]); nOffN++; }
}
report('tight-sand channel, bedding off', (nOn / nOnN) / (nOff / nOffN));
ok('the tight fill on its own reflects almost nothing',
  (nOn / nOnN) / (nOff / nOffN) < 1.10,
  'RC -0.0035, weaker than the bedding around it');
const tightWith = (tOn / tOnN) / (tOff / tOffN);
ok('the tight-sand channel is indistinguishable', Math.abs(tightWith - 1) < 0.12,
  'the fill does not reflect and the erosion surface has nothing to truncate against');
ok('the porous fill is the one that shows', contrast > 3.0 * tightWith,
  'the fill, not the incision, is what makes a channel visible here');

const noGas = VOL.build({ gas: false });
ok('gas can be switched off', VOL.rms(noGas.truth.gas) === 0);

const big = (() => { const t = Date.now(); VOL.build({ nx: 128, ny: 128, nt: 400 }); return Date.now() - t; })();
report('build time at 128x128x400, ms', big);

/* --------------------------------------------------------------- report */

const w = [4, 44, 12, 12, 8, 0];
const head = ['', 'quantity', 'measured', 'expected', 'tol', 'note'];
console.log('\n' + head.map((h, i) => h.padEnd(w[i])).join(' '));
console.log('-'.repeat(110));
rows.forEach(r => console.log(r.map((c, i) => String(c).padEnd(w[i])).join(' ')));
console.log('-'.repeat(110));
console.log(`${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
