/* ===========================================================================
   harness-06.js — open module 06 headless, drive every control, print readouts
   Run:  node harness-06.js     (needs: npm install jsdom)
   Every number quoted in module 06's prose must appear here.
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
const html = fs.readFileSync(path.resolve(__dirname, 'modules/attributes.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/attributes.html',
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

function bal(b) { doc.querySelector(`#segBal button[data-b="${b}"]`).click(); }

console.log('\n=== STEP 1 · five numbers from one spectrum ===');
tab('p1'); set('fd', 30); set('noise', 4); bal('raw'); set('py', 40);
for (const px of [48, 56, 64, 72]) {
  set('px', px);
  console.log(`  crossline ${String(px).padStart(2)} -> fill ${read('s1true').padStart(8)}  ` +
    `peak f ${read('s1pf').padStart(9)}  mean f ${read('s1mf').padStart(9)}  ` +
    `peak mag ${read('s1pm')}`);
}
// mean frequency should sit above peak frequency on a seismic spectrum
set('px', 60);
const pf1 = parseFloat(read('s1pf')), mf1 = parseFloat(read('s1mf'));
console.log(`  at the analysis point, mean ${mf1.toFixed(1)} Hz vs peak ${pf1.toFixed(1)} Hz`);
if (!(mf1 > pf1)) { fails++; console.log('   FAIL mean frequency should sit above peak frequency'); }

console.log('\n=== STEP 2 · peak frequency tracks thickness, magnitude does not ===');
tab('p2');
for (const f of [22, 30, 40]) {
  set('fd', f);
  console.log(`  wavelet ${String(f).padStart(2)} Hz -> peak f on thalweg ${read('s2ft').padStart(9)}  ` +
    `on margin ${read('s2fm').padStart(9)}  corr(freq) ${read('s2cf').padStart(6)}  ` +
    `corr(mag) ${read('s2cm')}`);
}
set('fd', 30);
const cf = parseFloat(read('s2cf')), cm = parseFloat(read('s2cm'));
console.log(`  peak frequency correlates ${cf.toFixed(2)} with fill; peak magnitude ${cm.toFixed(2)}`);
if (!(cf < -0.5)) { fails++; console.log('   FAIL peak frequency should correlate strongly and negatively'); }
if (!(Math.abs(cm) < Math.abs(cf))) { fails++; console.log('   FAIL magnitude should track thickness less well'); }
/* The two correlations the step 2 finding quotes, at the page defaults. */
expect('peak frequency correlation, as quoted', cf, -0.99, 0.02);
expect('peak magnitude correlation, as quoted', cm, 0.21, 0.03);
const ft = parseFloat(read('s2ft')), fm = parseFloat(read('s2fm'));
if (!(fm > ft)) { fails++; console.log('   FAIL the margin should read a higher frequency than the thalweg'); }

console.log('\n=== STEP 3 · how much of an ungated map is noise ===');
tab('p3'); set('fd', 30);
for (const g of [0, 10, 20, 40]) {
  set('gate', g);
  console.log(`  threshold ${String(g).padStart(2)}% -> map kept ${read('s3keep').padStart(5)}  ` +
    `of that, on channel ${read('s3on').padStart(5)}  off-channel spread raw ${read('s3raw').padStart(8)}  ` +
    `gated ${read('s3gate')}`);
}
set('gate', 0); const on0 = parseFloat(read('s3on'));
set('gate', 40); const on40 = parseFloat(read('s3on'));
console.log(`  raising the threshold takes the on-channel share from ${on0}% to ${on40}%`);
if (!(on40 > on0)) { fails++; console.log('   FAIL gating should raise the on-channel share'); }
set('gate', 20);

console.log('\n=== STEP 4 · three reductions of the same data ===');
tab('p4');
for (const n of [0, 4, 12, 20]) {
  set('noise', n);
  console.log(`  noise ${String(n).padStart(2)}% -> mean minus peak ${read('s4diff').padStart(9)}  ` +
    `corr: peak ${read('s4cp').padStart(6)}  mean ${read('s4cm').padStart(6)}  ` +
    `peak-above-avg ${read('s4ca')}`);
}
set('noise', 4);
const d = parseFloat(read('s4diff'));
console.log(`  mean frequency reads ${d.toFixed(1)} Hz above peak frequency on average`);
if (!(d > 0)) { fails++; console.log('   FAIL mean should read above peak on average'); }

console.log('\n=== STEP 5 · the delivered thickness map ===');
tab('p5');
for (const f of [22, 30, 40]) {
  set('fd', f);
  console.log(`  wavelet ${String(f).padStart(2)} Hz -> mean absolute error ${read('s5err').padStart(8)}  ` +
    `bias ${read('s5bias').padStart(8)}  best at ${read('s5best')}  worst at ${read('s5worst')}`);
}
set('fd', 30);
const e30 = parseFloat(read('s5err'));
console.log(`  at 30 Hz the map is ${e30.toFixed(1)} ms out on average`);

console.log('\n=== balancing, in map form ===');
tab('p2'); set('fd', 30); set('noise', 4);
for (const b of ['raw', 'bal']) {
  bal(b);
  console.log(`  ${b.padEnd(4)} -> corr(freq) ${read('s2cf').padStart(6)}  corr(mag) ${read('s2cm')}`);
}
bal('raw'); const cRaw = parseFloat(read('s2cf'));
bal('bal'); const cBal = parseFloat(read('s2cf'));
console.log(`  peak frequency correlation with fill: ${cRaw.toFixed(2)} raw, ${cBal.toFixed(2)} balanced`);
bal('raw');

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
