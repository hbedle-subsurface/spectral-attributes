/* ===========================================================================
   harness-02.js — open module 02 headless, drive every control, print readouts
   Run:  node harness-02.js     (needs: npm install jsdom)
   Every number quoted in module 02's prose must appear here.
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
const html = fs.readFileSync(path.resolve(__dirname, 'modules/windows.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/windows.html',
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
function wshape(w) { doc.querySelector(`#segWin button[data-w="${w}"]`).click(); }

let fails = 0;
function expect(label, got, want, tol) {
  const g = parseFloat(got), w = parseFloat(want);
  if (!(Math.abs(g - w) <= tol)) { fails++; console.log(`   FAIL ${label}: page says ${got}, prose says ${want}`); }
}

console.log('\n=== STEP 1 · the whole-trace spectrum is blind to time ===');
tab('p1');
for (const tb of [240, 300, 400, 460]) {
  set('tb', tb);
  console.log(`  deep event at ${String(tb).padStart(3)} ms -> difference ${read('s1diff')}  ` +
    `peak(as built) ${read('s1pa')}  peak(swapped) ${read('s1pb')}  mean ${read('s1mean')}`);
  expect(`spectra identical at tb=${tb}`, read('s1diff'), 0, 0.001);
}
set('tb', 400);

console.log('\n=== STEP 2 · one window, slid down the trace ===');
tab('p2'); set('win', 80);
for (const pos of [160, 280, 400]) {
  set('pos', pos);
  console.log(`  window at ${String(pos).padStart(3)} ms -> peak ${read('s2peak')}  ` +
    `energy ${read('s2amp')}`);
}
set('pos', 160); expect('peak over the shallow event', read('s2peak'), 50, 6);
const eShallow = parseFloat(read('s2amp'));
set('pos', 400); expect('peak over the deep event', read('s2peak'), 20, 6);
set('pos', 280);
const eGap = parseFloat(read('s2amp'));
console.log(`  energy on the event ${eShallow.toFixed(3)} vs in the gap ${eGap.toFixed(3)} ` +
  `(ratio ${(eShallow / Math.max(eGap, 1e-9)).toFixed(0)}x), yet the gap still reports ${read('s2peak')}`);

console.log('\n=== STEP 3/4 · the trade, measured ===');
tab('p4');
const rows = [];
for (const wl of [20, 40, 60, 80, 120, 200, 300]) {
  set('win', wl);
  const t = parseFloat(read('s4t')), f = parseFloat(read('s4f')), p = parseFloat(read('s4p'));
  rows.push({ wl, t, f, p });
  console.log(`  window ${String(wl).padStart(3)} ms -> time res ${String(t.toFixed(0)).padStart(3)} ms  ` +
    `freq res ${f.toFixed(1).padStart(5)} Hz  product ${p.toFixed(0)}`);
}
const tRange = Math.max(...rows.map(r => r.t)) / Math.min(...rows.map(r => r.t));
const fRange = Math.max(...rows.map(r => r.f)) / Math.min(...rows.map(r => r.f));
const pRange = Math.max(...rows.map(r => r.p)) / Math.min(...rows.map(r => r.p));
console.log(`  across that range: time res varies ${tRange.toFixed(1)}x, ` +
  `freq res ${fRange.toFixed(1)}x, product only ${pRange.toFixed(2)}x`);
if (pRange > 1.15) { fails++; console.log('   FAIL the product moved more than the prose claims'); }
if (tRange < 10 || fRange < 10) { fails++; console.log('   FAIL the two factors did not move much'); }
for (const r of rows) {
  expect(`time res is half of a ${r.wl} ms window`, r.t, r.wl / 2, 1.5);
  expect(`freq res is ~2/T at ${r.wl} ms`, r.f, 2000 / r.wl, Math.max(1.5, 0.06 * 2000 / r.wl));
}

console.log('\n=== STEP 3 · the window floor ===');
tab('p3');
for (const wl of [20, 40, 80, 300]) {
  set('win', wl);
  console.log(`  window ${String(wl).padStart(3)} ms -> floor ${read('s3floor')}  ` +
    `blob ${read('s3tw')} x ${read('s3fw')}`);
}
set('win', 20); expect('floor at 20 ms', read('s3floor'), 50, 0.2);
set('win', 40); expect('floor at 40 ms', read('s3floor'), 25, 0.2);
set('win', 80); expect('floor at 80 ms', read('s3floor'), 12.5, 0.2);

console.log('\n=== STEP 5 · window shape and leakage ===');
tab('p5'); set('win', 80);
for (const w of ['boxcar', 'hann', 'gauss']) {
  wshape(w);
  console.log(`  ${w.padEnd(7)} -> leakage ${read('s5leak')}  main peak ${read('s5main')}  ` +
    `found ${read('s5pk')}`);
}
wshape('boxcar'); const lb = parseFloat(read('s5leak')), mb = parseFloat(read('s5main'));
expect('boxcar leakage', lb, 0.2226, 0.01);
expect('boxcar main peak', mb, 14.7, 0.6);
wshape('hann');   const lh = parseFloat(read('s5leak')), mh = parseFloat(read('s5main'));
expect('hann leakage', lh, 0.0269, 0.004);
expect('hann main peak', mh, 25.4, 0.8);
wshape('gauss');  expect('gaussian leakage', read('s5leak'), 0.0066, 0.002);
wshape('hann');
console.log(`  boxcar leaks ${(lb / Math.max(lh, 1e-9)).toFixed(0)}x more than Hann, ` +
  `for a main peak ${(mb / mh).toFixed(2)}x as wide`);
if (lb <= lh) { fails++; console.log('   FAIL the boxcar was supposed to leak more'); }
if (mb > mh) { fails++; console.log('   FAIL the boxcar main peak should be narrower, not wider'); }

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
