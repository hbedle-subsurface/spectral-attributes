/* ===========================================================================
   harness-00.js — open module 00 headless, drive every control, print readouts
   Run:  node harness-00.js     (needs: npm install jsdom)
   Every number quoted in module 00's prose must appear here.
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
const html = fs.readFileSync(path.resolve(__dirname, 'modules/why.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/why.html',
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
const read0 = (id) => doc.getElementById(id).textContent;
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

console.log('\n=== STEP 1 · the band, and the thicknesses it favors ===');
tab('p1'); set('thick', 34); set('wide', 80); set('taper', 50); set('fc', 30);
for (const f of [20, 30, 45]) {
  set('fd', f);
  console.log(`  ${String(f).padStart(2)} Hz wavelet -> band ${read('s1band').padStart(11)}  ` +
    `thicknesses ${read('s1thick').padStart(14)}  = ${read('s1m').padStart(15)}  ` +
    `best ${read('s1best')}`);
}
set('fd', 30);
expect('best-imaged thickness at 30 Hz', read('s1best'), 1000 / (2 * 30), 1.2);

console.log('\n=== STEP 1 · the velocity slider drives the meters readout ===');
tab('p1'); set('fd', 30);
for (const v of [1800, 2500, 4000]) {
  set('vel', v);
  console.log(`  ${String(v).padStart(4)} m/s -> thicknesses ${read0('s1thick')}  =  ${read0('s1m')}`);
}
set('vel', 2500);

console.log('\n=== STEP 5 · the three color channels are drawn separately ===');
tab('p5');
for (const id of ['c5r', 'c5g', 'c5bl', 'c5a', 'c5b']) {
  if (!doc.getElementById(id)) { fails++; console.log('   FAIL missing panel ' + id); }
}
console.log(`  red/green/blue ${read('s5f')} -> thicknesses ${read('s5t')}`);
console.log(`  channel lit by the blend ${read('s5area')}, by the full-bandwidth map ${read('s5full')}`);

console.log('\n=== NOISE · what it costs the maps ===');
tab('p5'); set('fd', 30); set('fc', 30);
let prevLit = 101;
for (const nz of [0, 10, 20, 40]) {
  set('noise', nz);
  const lit = parseFloat(read('s5area')), full = parseFloat(read('s5full'));
  console.log(`  noise ${String(nz).padStart(2)}% -> blend covers ${String(lit).padStart(5)}%  ` +
    `full-bandwidth map covers ${String(full).padStart(5)}%`);
  /* Noise must never make the channel easier to see. The module 04 traceability
     readout failed exactly this way, so it is asserted rather than eyeballed. */
  if (lit > prevLit + 1) {
    fails++; console.log(`   FAIL noise ${nz}% covered more (${lit}) than a quieter map (${prevLit})`);
  }
  prevLit = lit;
}
set('noise', 0);

console.log('\n=== STEP 2 · the amplitude map is a contour of one thickness ===');
tab('p2');
for (const f of [18, 30, 45]) {
  set('fd', f);
  console.log(`  ${String(f).padStart(2)} Hz wavelet -> brightest where fill is ${read('s2bright').padStart(8)}  ` +
    `(tuning thickness ${(1000 / (2 * f)).toFixed(1)} ms)  thalweg ${read('s2thal')}  ` +
    `thalweg/margin amplitude ${read('s2ratio')}`);
  /* The bright part sits at the AMPLITUDE tuning thickness, which module 04
     measured at 0.780 times the spectral one, 1/(2f). Comparing against 1/(2f)
     itself is comparing against the wrong one of the two tuning thicknesses. */
  expect(`brightest fill at ${f} Hz`, read('s2bright'), 0.780 * 1000 / (2 * f), 1.2);
}
set('fd', 30);

console.log('\n=== STEP 3 · each frequency images a different contour ===');
tab('p3');
const found = [];
for (const f of [15, 25, 40, 60]) {
  set('fc', f);
  const bt = parseFloat(read('s3found'));
  found.push(bt);
  console.log(`  looking at ${String(f).padStart(2)} Hz -> images ${read('s3t').padStart(8)}  ` +
    `brightest fill found ${read('s3found').padStart(8)}  channel lit ${read('s3area')}`);
}
// the illuminated thickness must fall as the frequency rises
for (let i = 1; i < found.length; i++) {
  if (!(found[i] <= found[i - 1] + 0.5)) {
    fails++; console.log('   FAIL the bright zone did not move toward thinner fill');
  }
}
console.log(`  brightest fill walks ${found[0].toFixed(1)} -> ${found[found.length - 1].toFixed(1)} ms ` +
  `as the frequency goes 15 -> 60 Hz`);
set('fc', 30);

console.log('\n=== STEP 4 · the cross-channel profile ===');
tab('p4');
for (const iy of [25, 60, 100]) {
  set('iy', iy);
  console.log(`  profile ${String(iy).padStart(3)} -> thalweg ${read('s4thal').padStart(8)}  ` +
    `low component peaks at ${read('s4lo').padStart(12)}  high at ${read('s4hi').padStart(12)}  ` +
    `half-width ${read('s4w')}`);
}
console.log('\n=== STEP 4 · the seismic section across the channel ===');
for (const fd of [18, 30, 45]) {
  set('fd', fd); set('iy', 60);
  console.log(`  wavelet ${String(fd).padStart(2)} Hz -> fill at the axis ${read('s4sthal').padStart(8)}` +
    ` = ${read('s4sm').padStart(6)}   top and base ${read('s4ssep')}`);
}
set('fd', 30); set('iy', 60);
for (const vel of [2000, 2500, 3800]) {
  set('vel', vel);
  console.log(`  slider ${String(vel).padStart(4)} m/s -> ${read('s4sthal')} reads ${read('s4sm')}` +
    `, or ${read('s4sn')}`);
}
set('vel', 2500);

set('iy', 60);
const loFill = parseFloat(read('s4lo')), hiFill = parseFloat(read('s4hi'));
console.log(`  the low component peaks on ${loFill.toFixed(1)} ms fill, the high one on ${hiFill.toFixed(1)} ms`);
if (!(hiFill < loFill)) {
  fails++; console.log('   FAIL the high component should peak on thinner fill than the low one');
}

console.log('\n=== STEP 5 · the blend covers more than one map ===');
tab('p5');
for (const tp of [0, 30, 50, 80]) {
  set('taper', tp);
  console.log(`  downstream thinning ${String(tp).padStart(2)}% -> blend lights ${read('s5area').padStart(5)}  ` +
    `full-bandwidth map lights ${read('s5full').padStart(5)}`);
}
set('taper', 50);
const blend = parseFloat(read('s5area')), full = parseFloat(read('s5full'));
console.log(`  at the default channel: blend ${blend}% vs full bandwidth ${full}%`);
if (!(blend > full)) { fails++; console.log('   FAIL the blend should cover more of the channel'); }
for (const tp of [0, 50, 80]) {
  set('taper', tp);
  const d = parseFloat(read('s5area')) - parseFloat(read('s5full'));
  console.log(`  thinning ${String(tp).padStart(2)}%: blend beats the amplitude map by ${d.toFixed(0)} points`);
}
set('taper', 50);

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
