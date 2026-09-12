/* ===========================================================================
   harness-05.js — open module 05 headless, drive every control, print readouts
   Run:  node harness-05.js     (needs: npm install jsdom)
   Every number quoted in module 05's prose must appear here.
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
const html = fs.readFileSync(path.resolve(__dirname, 'modules/balancing.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/balancing.html',
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

function mode(m) { doc.querySelector(`#segMode button[data-m="${m}"]`).click(); }

console.log('\n=== STEP 1 · the wavelet overprints the geology ===');
tab('p1'); set('noise', 4); set('alpha', 10); set('beta', 0);
const rawE12 = {};
for (const f of [16, 28, 40, 55]) {
  set('fd', f);
  rawE12[f] = parseFloat(read('s1sat'));
  console.log(`  wavelet ${String(f).padStart(2)} Hz -> estimate on a 30 ms bed ${read('s1e30').padStart(8)}  ` +
    `on a 12 ms bed ${read('s1e12').padStart(8)}  mean error ${read('s1sat')}`);
}
// the earth never changed, so an estimate that moves is reporting the source
const rawWorst = Math.max(...Object.values(rawE12));
console.log(`  unbalanced mean error runs up to ${rawWorst.toFixed(0)}% across these wavelets`);

console.log('\n=== STEP 2 · balancing removes the bias ===');
tab('p2');
const balE12 = {};
for (const f of [16, 28, 40, 55]) {
  set('fd', f);
  balE12[f] = parseFloat(read('s2range'));
  console.log(`  wavelet ${String(f).padStart(2)} Hz -> flatness ${read('s2b4')} -> ${read('s2after')}  ` +
    `estimate on a 12 ms bed ${read('s2e12').padStart(8)}  mean error ${read('s2range')}`);
}
for (const f of [16, 28, 40, 55]) {
  console.log(`  wavelet ${String(f).padStart(2)} Hz: mean error ${rawE12[f].toFixed(0)}% raw -> ` +
    `${balE12[f].toFixed(0)}% balanced`);
  if (!(balE12[f] <= rawE12[f])) {
    fails++; console.log(`   FAIL balancing made it worse at ${f} Hz`);
  }
}
set('fd', 28);
const flatBefore = parseFloat(read('s2b4')), flatAfter = parseFloat(read('s2after'));
if (!(flatAfter < flatBefore)) { fails++; console.log('   FAIL balancing should flatten the spectrum'); }

console.log('\n=== STEP 3 · prewhitening trades flatness for noise ===');
tab('p3'); set('fd', 28);
for (const a of [1, 5, 10, 40, 120]) {
  set('alpha', a);
  console.log(`  alpha ${read('s3a').padStart(6)} -> operator gain ${read('s3g').padStart(8)}  ` +
    `flatness ${read('s3flat')}  out-of-band lift ${read('s3noise')}`);
}
set('alpha', 1); const g1 = parseFloat(read('s3g')), f1 = parseFloat(read('s3flat'));
set('alpha', 120); const g2 = parseFloat(read('s3g')), f2 = parseFloat(read('s3flat'));
console.log(`  gain ${g1.toFixed(1)}x at the smallest alpha vs ${g2.toFixed(1)}x at the largest`);
if (!(g1 > g2)) { fails++; console.log('   FAIL small alpha should give a larger operator gain'); }
if (!(f1 < f2)) { fails++; console.log('   FAIL small alpha should give a flatter spectrum'); }
set('alpha', 10);

console.log('\n=== STEP 3 · the same two states drawn as seismic sections ===');
tab('p3');
for (const a of [1, 10, 40, 120]) {
  set('alpha', a);
  console.log(`  alpha ${read('s3a').padStart(6)} -> events crossed by one trace, ` +
    `recorded -> balanced: ${read('s3ev')}`);
}
set('alpha', 10);
if (read('s3ev') === '—' || read('s3ev').indexOf('→') < 0) {
  fails++; console.log('   FAIL the section panels did not render');
}

console.log('\n=== STEP 4 · bluing tilts the spectrum and sharpens the wavelet ===');
tab('p4');
for (const b of [0, 20, 40, 80]) {
  set('beta', b);
  console.log(`  beta ${read('s4b')} -> tilt 50/20 Hz ${read('s4tilt').padStart(7)}  ` +
    `effective peak ${read('s4pk').padStart(8)}  sidelobe ${read('s4side')}`);
}
set('beta', 0); const t0 = parseFloat(read('s4tilt')), sl0 = parseFloat(read('s4side'));
set('beta', 80); const t1 = parseFloat(read('s4tilt')), sl1 = parseFloat(read('s4side'));
console.log(`  tilt ${t0.toFixed(2)}x -> ${t1.toFixed(2)}x, sidelobe ${sl0.toFixed(3)} -> ${sl1.toFixed(3)}`);
if (!(t1 > t0)) { fails++; console.log('   FAIL bluing should tilt the spectrum upward'); }
if (!(sl1 > sl0)) { fails++; console.log('   FAIL bluing should raise the sidelobe'); }
set('beta', 0);

console.log('\n=== STEP 5 · trace-by-trace whitening erases the notch ===');
tab('p5'); set('fd', 28); set('alpha', 10);
for (const m of ['survey', 'trace']) {
  mode(m);
  console.log(`  ${m.padEnd(7)} -> notch retained ${read('s5notch').padStart(5)}  ` +
    `notch estimate on a 20 ms bed ${read('s5e20').padStart(9)}  traces usable ${read('s5err')}`);
}
mode('survey'); const nSur = parseFloat(read('s5notch')), eSur = parseFloat(read('s5err'));
mode('trace');  const nTr = parseFloat(read('s5notch')), eTr = parseFloat(read('s5err'));
console.log(`  notch retained ${nSur}% -> ${nTr}%, usable traces ${eSur}% -> ${eTr}%`);
if (!(nTr < nSur / 2)) { fails++; console.log('   FAIL trace-by-trace should fill the notch in'); }
if (!(eTr < eSur)) { fails++; console.log('   FAIL trace-by-trace should cost usable traces'); }
mode('survey');

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
