/* ===========================================================================
   harness-04.js — open module 04 headless, drive every control, print readouts
   Run:  node harness-04.js     (needs: npm install jsdom)
   Every number quoted in module 04's prose must appear here.
   =========================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function stubCanvas(win) {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === 'measureText') return () => ({ width: 0 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (typeof k === 'string' && /^(set|get)[A-Z]/.test(k)) return noop;
      return noop;
    },
    set() { return true; },
  });
  win.HTMLCanvasElement.prototype.getContext = () => ctx;
  Object.defineProperty(win.HTMLElement.prototype, 'clientWidth', { get() { return 900; } });
  const cs = win.getComputedStyle.bind(win);
  win.getComputedStyle = (el) => {
    const s = cs(el);
    return new Proxy(s, {
      get(t, k) {
        if (k === 'paddingLeft' || k === 'paddingRight') return '26px';
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
  };
}

const seis = fs.readFileSync(path.resolve(__dirname, 'assets/seismic.js'), 'utf8');
const spec = fs.readFileSync(path.resolve(__dirname, 'assets/spectral.js'), 'utf8');
const strata = fs.readFileSync(path.resolve(__dirname, 'assets/strata.js'), 'utf8');
const volume = fs.readFileSync(path.resolve(__dirname, 'assets/volume.js'), 'utf8');
const volp = fs.readFileSync(path.resolve(__dirname, 'assets/volpanels.js'), 'utf8');
/* jsdom runs inline scripts while parsing, so both libraries have to already be
   in the document or the module's own missing-library guard fires. */
const html = fs.readFileSync(path.resolve(__dirname, 'modules/tuning.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/tuning.html',
  beforeParse(win) {
    stubCanvas(win);
    win.devicePixelRatio = 1;
    win.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    win.addEventListener('error', (e) => { threwOnLoad = e.message || String(e.error); });
  },
});
const win = dom.window, doc = win.document;
if (threwOnLoad) { console.error('threw while loading: ' + threwOnLoad); process.exit(1); }
if ([...doc.querySelectorAll('.wrap > div')].some((d) => /841617/.test(d.getAttribute('style') || ''))) {
  console.error('the module printed its missing-library banner'); process.exit(1);
}

const $ = (id) => doc.getElementById(id);
const read = (id) => { const el = $(id); return el ? el.textContent.trim() : '(missing)'; };
function tab(id) { doc.querySelector(`#tabs button[data-tab="${id}"]`).click(); }
function set(id, v) {
  const el = $(id); el.value = String(v);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}


let fails = 0;
function expect(label, got, want, tol) {
  const g = parseFloat(got), w = parseFloat(want);
  if (!(Math.abs(g - w) <= tol)) { fails++; console.log(`   FAIL ${label}: page says ${got}, prose says ${want}`); }
}

console.log('\n=== STEP 1 · the wedge, amplitude and apparent thickness ===');
tab('p1'); set('fd', 30); set('thick', 60); set('noise', 0);
for (const ix of [0, 30, 60, 90, 110]) {
  set('ix', ix);
  console.log(`  trace ${String(ix).padStart(3)} -> true ${read('s1true').padStart(8)}  ` +
    `apparent ${read('s1app').padStart(8)}`);
}
console.log(`  amplitude peaks at ${read('s1tune')};  apparent thickness floor ${read('s1floor')}`);
const ampTune30 = parseFloat(read('s1tune'));
const floor30 = parseFloat(read('s1floor'));
// above tuning, a picked thickness should be about right; below it, it must not be
set('ix', 20); const trueThick = parseFloat(read('s1true')), appThick = parseFloat(read('s1app'));
expect('apparent tracks true well above tuning', appThick, trueThick, 3.5);
set('ix', 115);
const t2 = parseFloat(read('s1true')), a2 = parseFloat(read('s1app'));
console.log(`  near the pinch-out: true ${t2.toFixed(1)} ms but picked ${a2.toFixed(1)} ms ` +
  `(${(a2 / Math.max(t2, 0.1)).toFixed(1)}x too thick)`);
if (!(a2 > t2 * 1.5)) { fails++; console.log('   FAIL apparent thickness should overstate a very thin bed'); }

console.log('\n=== STEP 1 · the same bed inside stratigraphy, by lithology ===');
tab('p1');
for (const k of ['sandInShale', 'gasInShale', 'coalInSand', 'limeInShale', 'wetInShale']) {
  const btn = [...doc.querySelectorAll('#segLith button')].find((b) => b.dataset.lith === k);
  btn.dispatchEvent(new win.Event('click', { bubbles: true }));
  console.log(`  ${read('s1lith').padEnd(24)} RC ${read('s1rc').padStart(7)}  ` +
    `vs bedding ${read('s1contrast').padStart(7)}  ${read('s1vis')}`);
}
const strong = [...doc.querySelectorAll('#segLith button')].find((b) => b.dataset.lith === 'coalInSand');
strong.dispatchEvent(new win.Event('click', { bubbles: true }));
const rcCoal = Math.abs(parseFloat(read('s1rc')));
const wet = [...doc.querySelectorAll('#segLith button')].find((b) => b.dataset.lith === 'wetInShale');
wet.dispatchEvent(new win.Event('click', { bubbles: true }));
const rcWet = Math.abs(parseFloat(read('s1rc')));
if (!(rcCoal > rcWet * 10)) { fails++; console.log('   FAIL coal should far exceed wet sand'); }
if (read('s1vis') !== 'weaker than bedding') {
  fails++; console.log('   FAIL a wet sand in shale should be weaker than the bedding');
}
[...doc.querySelectorAll('#segLith button')].find((b) => b.dataset.lith === 'sandInShale')
  .dispatchEvent(new win.Event('click', { bubbles: true }));

console.log('\n=== STEP 1 · frequency and noise, seen on the section ===');
tab('p1');
[...doc.querySelectorAll('#segLith button')].find((b) => b.dataset.lith === 'gasInShale')
  .dispatchEvent(new win.Event('click', { bubbles: true }));
set('noise', 0);
for (const f of [18, 30, 45]) {
  set('fd', f);
  console.log(`  ${String(f).padStart(2)} Hz, no noise    -> bed traceable down to ${read('s1trace').padStart(9)}`);
}
set('fd', 30);
for (const nz of [0, 10, 30, 60]) {
  set('noise', nz);
  console.log(`  30 Hz, noise ${String(nz).padStart(2)}%    -> bed traceable down to ${read('s1trace').padStart(9)}`);
}
set('noise', 0); set('fd', 45); const thin45 = parseFloat(read('s1trace'));
set('fd', 18); const thin18 = parseFloat(read('s1trace'));
if (!(thin45 < thin18)) {
  fails++; console.log('   FAIL a higher frequency should follow the bed to a thinner point');
}
/* Noise must never make the bed easier to follow. An earlier version of this
   readout compared an amplitude against a raw reflection coefficient and did
   exactly that, so the monotonicity is checked rather than assumed. */
set('fd', 30);
let prevThin = -1;
for (const nz of [0, 10, 30, 60]) {
  set('noise', nz);
  const t = parseFloat(read('s1trace'));
  if (t < prevThin - 0.05) {
    fails++; console.log(`   FAIL noise ${nz}% traced thinner (${t}) than a quieter section (${prevThin})`);
  }
  prevThin = t;
}
set('fd', 30); set('noise', 0);
[...doc.querySelectorAll('#segLith button')].find((b) => b.dataset.lith === 'sandInShale')
  .dispatchEvent(new win.Event('click', { bubbles: true }));

console.log('\n=== STEP 2 · the notch sits at 1/T ===');
tab('p2');
for (const ix of [10, 30, 50, 70, 90]) {
  set('ix', ix);
  console.log(`  true ${read('s2true').padStart(8)} -> predicted notch ${read('s2pred').padStart(9)}  ` +
    `measured ${read('s2meas').padStart(11)}  peak 1/(2T) ${read('s2peak')}`);
  const pred = parseFloat(read('s2pred')), meas = parseFloat(read('s2meas'));
  if (isFinite(meas)) expect(`notch at trace ${ix}`, meas, pred, Math.max(2, 0.08 * pred));
}

console.log('\n=== STEP 3 · thickness read out of the spectrum ===');
tab('p3');
for (const ix of [20, 50, 80, 100]) {
  set('ix', ix);
  console.log(`  true ${read('s3true').padStart(8)} -> from peak frequency ${read('s3fp').padStart(8)}  ` +
    `from notch spacing ${read('s3ns').padStart(11)}`);
}
console.log(`  peak-frequency estimate works between ${read('s3lim')}`);
console.log(`  compare: picked thickness went flat at ${floor30.toFixed(1)} ms`);

console.log('\n=== STEP 4 · two tuning thicknesses ===');
tab('p4');
const ratios = [];
for (const f of [15, 20, 30, 45, 60]) {
  set('fd', f);
  const r = parseFloat(read('s4rat'));
  ratios.push(r);
  console.log(`  ${String(f).padStart(2)} Hz -> amplitude tuning ${read('s4amp').padStart(8)}  ` +
    `spectral 1/(2f) ${read('s4spec').padStart(8)}  ratio ${r.toFixed(3)}`);
}
const rMin = Math.min(...ratios), rMax = Math.max(...ratios);
console.log(`  ratio across the range: ${rMin.toFixed(3)} to ${rMax.toFixed(3)}`);
if (rMax - rMin > 0.06) { fails++; console.log('   FAIL the ratio was supposed to be near constant'); }
if (!(rMax < 1)) { fails++; console.log('   FAIL amplitude tuning should be the thinner of the two'); }
set('fd', 30);

console.log('\n=== STEP 4 · the two tunings as fractions of a wavelength ===');
tab('p4');
for (const f of [15, 30, 45, 60]) {
  set('fd', f);
  console.log(`  ${String(f).padStart(2)} Hz -> amplitude ${read('s4amp').padStart(8)} = ${read('s4wla').padStart(7)}` +
    `   spectral ${read('s4spec').padStart(8)} = ${read('s4wl')}`);
}
set('fd', 30);

console.log('\n=== STEP 5 · below the limit the shape stops changing ===');
tab('p5');
for (const t of [24, 12, 6, 3]) {
  set('tthin', t);
  console.log(`  ${String(t).padStart(2)} ms vs ${(t / 2).toFixed(1)} ms -> waveform differs by ` +
    `${read('s5wf').padStart(7)}  peak freq ${read('s5pf')} vs ${read('s5pf2')}`);
}
set('tthin', 24); const d24 = parseFloat(read('s5wf'));
set('tthin', 3);  const d3 = parseFloat(read('s5wf'));
const pf3 = parseFloat(read('s5pf')), pf3b = parseFloat(read('s5pf2'));
console.log(`  waveform difference collapses ${d24.toFixed(1)}% -> ${d3.toFixed(1)}% ` +
  `while peak frequency still separates ${pf3.toFixed(1)} vs ${pf3b.toFixed(1)} Hz`);
if (!(d3 < d24 / 2)) { fails++; console.log('   FAIL the two shapes should converge as the bed thins'); }
set('tthin', 6);

console.log('\n=== noise fills the notch ===');
tab('p3'); set('fd', 30); set('ix', 70);
for (const n of [0, 10, 30, 60]) {
  set('noise', n);
  console.log(`  noise ${String(n).padStart(2)}% -> true ${read('s3true').padStart(8)}  ` +
    `peak-frequency ${read('s3fp').padStart(8)}  notch ${read('s3ns').padStart(11)}`);
}
set('noise', 0);

console.log('\n=== the working range moves with the wavelet ===');
tab('p3'); set('noise', 0); set('thick', 60);
for (const f of [20, 30, 45, 60]) {
  set('fd', f);
  console.log(`  ${String(f).padStart(2)} Hz wavelet -> peak-frequency estimate works ${read('s3lim')}`);
}
set('fd', 30);

// every number the prose now quotes
tab('p1'); set('fd', 30); set('thick', 60); set('noise', 0);
/* Tight, because the readout is now refined below the wedge's trace spacing.
   At 0.4 it passed on the 13.1 the raw grid used to report. */
expect('amplitude tuning at 30 Hz', ampTune30, 13.0, 0.15);
expect('apparent thickness floor', floor30, 11.1, 0.4);
tab('p4'); set('fd', 30); expect('tuning ratio', read('s4rat'), 0.780, 0.008);
tab('p3'); set('fd', 30); expect('working range at 30 Hz', parseFloat(read('s3lim')), 13.1, 0.4);
tab('p5'); set('tthin', 24); expect('waveform difference at 24 ms', read('s5wf'), 126.0, 3);
set('tthin', 3); expect('waveform difference at 3 ms', read('s5wf'), 21.6, 2);
expect('peak frequency, 3 ms bed', read('s5pf'), 36.7, 0.5);
expect('peak frequency, 1.5 ms bed', read('s5pf2'), 36.8, 0.5);

console.log('\n=== every tab renders without throwing ===');
let threw = null;
win.addEventListener('error', (e) => { threw = e.message; });
for (const t of ['p1', 'p2', 'p3', 'p4', 'p5', 'pw', 'pe', 'pk', 'pm']) {
  tab(t);
  const pane = $(t);
  if (pane.hidden || !pane.querySelector('.stepnav')) {
    fails++; console.log(`   FAIL ${t}: hidden=${pane.hidden} stepnav=${!!pane.querySelector('.stepnav')}`);
  }
}
console.log('  all nine panes shown with step navigation');
if (threw) { fails++; console.log('   FAIL an error was thrown: ' + threw); }

console.log(fails ? `\n${fails} problem(s)\n` : '\nall readouts agree with the prose\n');
process.exit(fails ? 1 : 0);
