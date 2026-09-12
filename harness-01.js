/* ===========================================================================
   harness-01.js — open module 01 headless, drive every control, print readouts

   Run:  node harness-01.js
   Needs: npm install jsdom

   This is the measurement instrument as well as the regression test. Any number
   quoted in module 01's prose, legends or exercise hints must appear here.
   =========================================================================== */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

/* A canvas stub: the module never reads pixels back, it only draws, so every
   2d context call can be a no-op. Anything that returns a value returns
   something harmless of the right shape. */
function stubCanvas(win) {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === 'measureText') return () => ({ width: 0 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (typeof k === 'string' && /^(set|get)[A-Z]/.test(k)) return noop;
      return noop;
    },
    set() { return true; },
  });
  win.HTMLCanvasElement.prototype.getContext = () => ctx;
  // jsdom reports zero for layout, so give the panes a believable content box
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

const file = path.resolve(__dirname, 'modules/spectrum.html');
const seis = fs.readFileSync(path.resolve(__dirname, 'assets/seismic.js'), 'utf8');
const volume = fs.readFileSync(path.resolve(__dirname, 'assets/volume.js'), 'utf8');
const volp = fs.readFileSync(path.resolve(__dirname, 'assets/volpanels.js'), 'utf8');

/* jsdom runs inline scripts during parsing, so the library has to already be
   in the document by then or the module's own missing-library guard fires.
   Inline it in place of the <script src>, and drop count.js, which is the only
   thing on the page that would touch the network. */
const html = fs.readFileSync(file, 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>',
           '<script>' + seis + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/spectrum.html',
  beforeParse(win) {
    stubCanvas(win);
    win.devicePixelRatio = 1;
    win.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    win.addEventListener('error', (e) => { threwOnLoad = e.message || String(e.error); });
  },
});
const win = dom.window, doc = win.document;

if (threwOnLoad) { console.error('the module threw while loading: ' + threwOnLoad); process.exit(1); }
if ([...doc.querySelectorAll('.wrap > div')].some((d) => /841617/.test(d.getAttribute('style') || ''))) {
  console.error('the module printed its missing-library banner');
  process.exit(1);
}

const $ = (id) => doc.getElementById(id);
const read = (id) => { const el = $(id); return el ? el.textContent.trim() : '(missing)'; };

function tab(id) { doc.querySelector(`#tabs button[data-tab="${id}"]`).click(); }
function set(id, v) {
  const el = $(id);
  el.value = String(v);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}
function seg(type) { doc.querySelector(`#segType button[data-type="${type}"]`).click(); }

let fails = 0;
function expect(label, got, want, tol) {
  const g = parseFloat(got), w = parseFloat(want);
  const ok = Math.abs(g - w) <= tol;
  if (!ok) { fails++; console.log(`   FAIL ${label}: page says ${got}, prose says ${want}`); }
  return ok;
}

console.log('\n=== STEP 1 · peak vs mean frequency (Ricker) ===');
tab('p1'); seg('ricker');
for (const f of [15, 30, 60]) {
  set('rf', f);
  const peak = read('s1peak'), mean = read('s1mean'), bw = read('s1bw');
  const ratio = parseFloat(mean) / parseFloat(peak);
  console.log(`  ricker ${f} Hz -> peak ${peak}  mean ${mean}  bw ${bw}  ` +
    `length ${read('s1len')}  wavelength ${read('s1lam')}  mean/peak ${ratio.toFixed(3)}`);
  expect(`ricker ${f} mean/peak`, ratio, 1.128, 0.01);
}
set('rf', 30);
expect('step1 peak', read('s1peak'), 30.0, 0.15);
expect('step1 mean', read('s1mean'), 33.9, 0.2);
/* The first-trough readout moved to step 3 when step 1 gained the wavelength
   readout, so step 1 now checks the wavelength instead: 2500 / 30 = 83 m. */
expect('step1 wavelength', read('s1lam'), 83, 1);
set('rf', 15); expect('step1 wavelength at 15 Hz', read('s1lam'), 167, 1);
set('rf', 55); expect('step1 wavelength at 55 Hz', read('s1lam'), 45, 1);
set('rf', 30);

console.log('\n=== STEP 1 · the velocity slider drives the wavelength readout ===');
set('rf', 30);
for (const v of [1800, 2500, 4000]) {
  set('vel', v);
  console.log(`  ${String(v).padStart(4)} m/s at 30 Hz -> wavelength ${read('s1lam')}`);
  expect(`wavelength at ${v} m/s`, read('s1lam'), v / 30, 1.5);
}
set('vel', 2500);

console.log('\n=== HEADER · the three survey presets ===');
for (const rf of [15, 30, 55]) {
  const btn = [...doc.querySelectorAll('#segPreset button')].find((b) => b.dataset.rf === String(rf));
  btn.dispatchEvent(new win.Event('click', { bubbles: true }));
  console.log(`  preset ${rf} Hz -> peak ${read('s1peak')}  wavelength ${read('s1lam')}  ` +
    `pressed ${btn.getAttribute('aria-pressed')}`);
  expect(`preset ${rf} sets peak frequency`, read('s1peak'), rf, 0.2);
}
set('rf', 30);

console.log('\n=== STEP 1 · the wavelet that comes back from depth ===');
tab('p1');
for (const q of [30, 80, 200]) {
  set('qf', q);
  console.log(`  Q ${String(q).padStart(3)} -> peak ${read('s1d1').padStart(8)} at 0.5 s and ${read('s1d2').padStart(8)} at 3.0 s` +
    `   thinnest bed ${read('s1d3').padStart(16)} -> ${read('s1d4')}`);
}
set('qf', 80);

console.log('\n=== STEP 2 · partial reconstruction (Ormsby 5-10-60-70) ===');
tab('p2'); seg('ormsby');
set('o1', 5); set('o2', 10); set('o3', 60); set('o4', 70);
for (const n of [1, 3, 5, 10, 20, 40]) {
  set('ncomp', n);
  console.log(`  ${String(n).padStart(2)} components -> energy ${read('s2e')}  ` +
    `highest ${read('s2f')}  worst error ${read('s2err')}`);
}
set('ncomp', 1);  expect('step2 energy at 1', read('s2e'), 3.6, 0.6);
set('ncomp', 5);  expect('step2 energy at 5', read('s2e'), 17.9, 1.2);
set('ncomp', 10); expect('step2 energy at 10', read('s2e'), 35.8, 1.5);
set('ncomp', 20); expect('step2 energy at 20', read('s2e'), 71.2, 2.0);

console.log('\n=== STEP 3 · high cut buys resolution ===');
tab('p3'); set('tap', 10);
for (const hi of [25, 40, 60, 80, 110]) {
  set('hi', hi);
  console.log(`  high cut ${String(hi).padStart(3)} Hz -> lobe ${read('s3lobe')}  ` +
    `bw ${read('s3bw')}  sidelobe ${read('s3side')}  length ${read('s3len')}`);
}
set('hi', 25);  expect('lobe at 25 Hz high cut', read('s3lobe'), 13.3, 0.4);
set('hi', 110); expect('lobe at 110 Hz high cut', read('s3lobe'), 4.1, 0.3);
set('hi', 25);  expect('length at 25 Hz high cut', read('s3len'), 176, 6);
set('hi', 110); expect('length at 110 Hz high cut', read('s3len'), 98, 6);

console.log('\n=== STEP 3 · a sharp corner costs, and buys nothing ===');
set('hi', 60);
for (const tp of [10, 5, 2, 1]) {
  set('tap', tp);
  console.log(`  taper ${String(tp).padStart(2)} Hz -> lobe ${read('s3lobe')}  ` +
    `sidelobe ${read('s3side')}  length ${read('s3len')}`);
}
set('hi', 60);
set('tap', 10); const lobeWide = parseFloat(read('s3lobe')), sideWide = parseFloat(read('s3side'));
expect('taper 10 sidelobe', sideWide, 0.025, 0.004);
expect('taper 10 length', read('s3len'), 120, 5);
set('tap', 1);  const lobeThin = parseFloat(read('s3lobe')), sideThin = parseFloat(read('s3side'));
expect('taper 1 sidelobe', sideThin, 0.054, 0.005);
expect('taper 1 length', read('s3len'), 303, 8);
console.log(`  lobe moved ${(lobeThin - lobeWide).toFixed(2)} ms; sidelobe went ` +
  `${sideWide.toFixed(3)} -> ${sideThin.toFixed(3)}`);
if (Math.abs(lobeThin - lobeWide) > 0.8) {
  fails++; console.log('   FAIL the central lobe moved more than the prose claims');
}
if (sideThin <= sideWide) { fails++; console.log('   FAIL ringing did not grow with a sharper corner'); }

console.log('\n=== STEP 4 · same hertz, fewer octaves ===');
tab('p4');
for (const c of [28, 33, 48, 78]) {
  set('cen', c);
  console.log(`  center ${String(c).padStart(2)} Hz -> octaves ${read('s4oct')}  ` +
    `bw ${read('s4bw')}  sidelobe ${read('s4side')}  lobe ${read('s4lobe')}`);
}
set('cen', 28); const bwLo = parseFloat(read('s4bw')), sideLo = parseFloat(read('s4side'));
expect('octaves at 28', read('s4oct'), 2.12, 0.03);
expect('sidelobe at 28', sideLo, 0.103, 0.006);
expect('lobe at 28', read('s4lobe'), 8.9, 0.3);
set('cen', 78); const bwHi = parseFloat(read('s4bw')), sideHi = parseFloat(read('s4side'));
expect('octaves at 78', read('s4oct'), 0.66, 0.03);
expect('sidelobe at 78', sideHi, 0.700, 0.02);
expect('lobe at 78', read('s4lobe'), 3.2, 0.3);
console.log(`  bandwidth ${bwLo.toFixed(1)} -> ${bwHi.toFixed(1)} Hz while ` +
  `sidelobe ${sideLo.toFixed(3)} -> ${sideHi.toFixed(3)}`);
if (Math.abs(bwHi - bwLo) > 6) { fails++; console.log('   FAIL bandwidth was supposed to stay put'); }
if (sideHi < 3 * sideLo) { fails++; console.log('   FAIL ringing did not climb as octaves fell'); }

console.log('\n=== STEP 5 · Nyquist and aliasing ===');
tab('p5'); set('si', 3);                       // 4 ms
for (const f of [60, 100, 124, 150, 200, 240]) {
  set('tone', f);
  console.log(`  ${String(f).padStart(3)} Hz at 4 ms -> nyquist ${read('s5ny')}  ` +
    `comes back as ${read('s5alias')}  [${read('s5stat')}]`);
}
set('tone', 150); expect('150 Hz at 4 ms', read('s5alias'), 100, 0.5);
set('tone', 200); expect('200 Hz at 4 ms', read('s5alias'), 50, 0.5);
set('tone', 240); expect('240 Hz at 4 ms', read('s5alias'), 10, 0.5);
set('si', 2); set('tone', 150);
expect('150 Hz at 2 ms is fine', read('s5alias'), 150, 0.5);

console.log('\n=== every tab renders without throwing ===');
let threw = null;
win.addEventListener('error', (e) => { threw = e.message; });
for (const t of ['p1', 'p2', 'p3', 'p4', 'p5', 'pw', 'pe', 'pk', 'pm']) {
  tab(t);
  const pane = $(t);
  console.log(`  ${t}: ${pane.hidden ? 'HIDDEN (wrong)' : 'shown'}` +
    `, stepnav ${pane.querySelector('.stepnav') ? 'present' : 'MISSING'}`);
  if (pane.hidden || !pane.querySelector('.stepnav')) fails++;
}
if (threw) { fails++; console.log('   FAIL an error was thrown: ' + threw); }

console.log('\n=== labhead visibility ===');
for (const t of ['p1', 'p2', 'p3', 'pe']) {
  tab(t);
  const lab = doc.querySelector('.labhead');
  console.log(`  ${t}: header ${lab.hidden ? 'hidden' : 'shown'}`);
}

console.log(fails ? `\n${fails} problem(s)\n` : '\nall readouts agree with the prose\n');
process.exit(fails ? 1 : 0);
