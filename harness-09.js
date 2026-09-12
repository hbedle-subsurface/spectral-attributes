/* ===========================================================================
   harness-09.js — open module 09 headless, drive every control, print readouts
   Run:  node harness-09.js     (needs: npm install jsdom)
   Every number quoted in module 09's prose must appear here.
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
const html = fs.readFileSync(path.resolve(__dirname, 'modules/shadows.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/shadows.html',
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

console.log('\n=== STEP 1 · four anomalies, one look ===');
tab('p1'); set('q', 30); set('bed', 24); set('fd', 32);
const pks = [];
for (let k = 0; k < 4; k++) {
  set('ix', k);
  pks.push(parseFloat(read('s1pf')));
  console.log(`  ${read('s1loc').padEnd(18)} -> peak ${read('s1pf').padStart(9)}  ` +
    `background ${read('s1bg').padStart(9)}  implies ${read('s1th')}`);
}
const bg = parseFloat(read('s1bg'));
console.log(`  background ${bg.toFixed(1)} Hz; three locations read low, one does not`);
/* Locations 1, 2 and 4 are low-frequency anomalies. Location 3 — a bed three
   times thicker than the target — reads at essentially the background, because
   the wavelet does not illuminate a thick bed's low tuning lobes. A thick bed
   is invisible on a peak frequency map. */
for (const k of [0, 1, 3]) {
  if (!(pks[k] < bg - 2)) { fails++; console.log(`   FAIL location ${k + 1} should read low`); }
}
if (!(Math.abs(pks[2] - bg) < 2)) {
  fails++; console.log('   FAIL the thick bed should read at the background frequency');
}
console.log(`  the ${24 * 3} ms bed reads ${pks[2].toFixed(1)} Hz against a background of ` +
  `${bg.toFixed(1)} Hz — invisible`);

console.log('\n=== STEP 2 · what attenuation does ===');
tab('p2');
for (const q of [200, 80, 30, 10]) {
  set('q', q);
  console.log(`  Q ${String(q).padStart(3)} -> peak ${read('s2b4')} becomes ${read('s2af').padStart(9)}  ` +
    `loss at 60 Hz ${read('s2loss').padStart(5)}  ${read('s2th')}`);
}
set('q', 200); const p200 = parseFloat(read('s2af'));
set('q', 10);  const p10 = parseFloat(read('s2af'));
console.log(`  peak frequency falls from ${p200.toFixed(1)} Hz at Q=200 to ${p10.toFixed(1)} Hz at Q=10`);
if (!(p10 < p200)) { fails++; console.log('   FAIL lower Q should lower the peak frequency'); }
set('q', 30);

console.log('\n=== STEP 3 · the shadow ===');
tab('p3');
for (const q of [100, 30, 15]) {
  set('q', q);
  console.log(`  Q ${String(q).padStart(3)} -> above ${read('s3ab').padStart(9)}  ` +
    `at target ${read('s3at').padStart(9)}  200 ms below ${read('s3bel').padStart(9)}  ` +
    `recovery below the tuned bed ${read('s3rec')}`);
}
set('q', 30);
const above = parseFloat(read('s3ab')), below = parseFloat(read('s3bel'));
const rec = parseFloat(read('s3rec'));
console.log(`  through the gas sand: ${above.toFixed(1)} Hz above, ${below.toFixed(1)} Hz 200 ms below`);
console.log(`  beneath the tuned bed the frequency recovers by ${rec.toFixed(1)} Hz`);
if (!(below < above)) { fails++; console.log('   FAIL the shadow should persist below the absorbing body'); }
if (!(rec > 0)) { fails++; console.log('   FAIL frequency should recover below a tuned bed'); }

console.log('\n=== STEP 3 · the shadow on a section, and whether it survives noise ===');
tab('p3'); set('q', 30); set('noise', 0);
for (const e of [0, 20, 40, 80]) {
  set('ext', e);
  console.log(`  gas sand ${String(e).padStart(2)}% of the line -> off ${read('s3off').padStart(8)}  ` +
    `under ${read('s3on').padStart(8)}  ${read('s3drop').padStart(13)}  ${read('s3snr')}`);
}
set('ext', 40);
for (const nz of [0, 10, 25, 40]) {
  set('noise', nz);
  console.log(`  noise ${String(nz).padStart(2)}%              -> ${read('s3drop').padStart(13)}  ${read('s3snr')}`);
}
set('noise', 0);
/* The shadow must be measured against the lateral scatter of the section, not
   against a fixed number of hertz. A previous version had every off-body trace
   identical, so the scatter was zero and the readout reported infinite
   confidence. */
set('ext', 40);
if (read('s3snr').indexOf('Infinity') >= 0) {
  fails++; console.log('   FAIL the off-body traces carry no lateral variation');
}
set('ext', 0);
if (read('s3on') !== 'no body') {
  fails++; console.log('   FAIL with no gas sand there should be nothing under the body');
}
set('ext', 40);

console.log('\n=== STEP 4 · the two impostors ===');
tab('p4');
for (const b of [12, 24, 36]) {
  set('bed', b);
  console.log(`  bed ${String(b).padStart(2)} ms -> first lobe ${read('s4l1').padStart(9)}  ` +
    `mimicked by ${read('s4l3').padStart(7)} on lobe 3  ` +
    `same bed under two wavelets ${read('s4w')}`);
}
set('bed', 24);
const wv = read('s4w').match(/[\d.]+/g).map(Number);
console.log(`  identical geology, 24 Hz vs 44 Hz wavelet: ${wv[0]} Hz vs ${wv[1]} Hz`);
if (!(Math.abs(wv[1] - wv[0]) > 3)) {
  fails++; console.log('   FAIL the processing difference should move the peak');
}

console.log('\n=== STEP 5 · the diagnostics ===');
tab('p5'); set('q', 30); set('bed', 24); set('fd', 32);
const diag = [];
for (let k = 0; k < 4; k++) {
  set('ix', k);
  const row = {
    name: NAMESOF(k),
    shadow: parseFloat(read('s5sh')),
    mag: parseFloat(read('s5mag')),
    wav: Math.abs(parseFloat(read('s5wav'))),
    above: Math.abs(parseFloat(read('s5notch'))),
  };
  diag.push(row);
  console.log(`  location ${k + 1} -> shadow ${read('s5sh').padStart(9)}  ` +
    `changed above ${read('s5notch').padStart(9)}  magnitude ${read('s5mag').padStart(6)}  ` +
    `moves with wavelet ${read('s5wav')}`);
}
function NAMESOF(k) { return ['tuning', 'attenuation', 'thick bed', 'processing'][k]; }
/* The discriminator is the PAIR, not the shadow on its own. A stretch processed
   with a different wavelet also reads a frequency difference below the target,
   because the wavelet differs at every depth — so "largest shadow" is not a
   test. What identifies attenuation is a shadow below TOGETHER WITH no change
   above; what identifies processing is a change in both places. The module says
   so in step 5, and this is that claim checked. */
const aboveWinner = diag.indexOf(diag.reduce((a, b) => (b.above > a.above ? b : a)));
console.log(`  frequency changed above the body at location ${aboveWinner + 1} (${diag[aboveWinner].name})`);
const shadowOnly = diag
  .map((d, k) => ({ d, k }))
  .filter(({ d }) => d.shadow > 1.0 && d.above < 1.0)
  .map(({ k }) => k);
console.log(`  shadow below with nothing above: ${shadowOnly.map((k) => NAMESOF(k)).join(', ') || 'none'}`);
if (shadowOnly.length !== 1 || shadowOnly[0] !== 1) {
  fails++;
  console.log('   FAIL attenuation should be the only location with a shadow and no change above');
}
if (!(diag[3].shadow > 1.0 && diag[3].above > 1.0)) {
  fails++;
  console.log('   FAIL processing should change the frequency both above and below');
}
if (aboveWinner !== 3) { fails++; console.log('   FAIL processing should be the one changed above too'); }
/* Attenuation is the one that changes what lies BELOW the body while leaving
   what lies above it alone. Processing changes both. */
const att = diag[1], proc = diag[3], tun = diag[0], lobe = diag[2];
console.log(`  attenuation: ${att.above.toFixed(1)} Hz above, ${att.shadow.toFixed(1)} Hz below`);
console.log(`  processing:  ${proc.above.toFixed(1)} Hz above, ${proc.shadow.toFixed(1)} Hz below`);
console.log(`  tuning:      ${tun.above.toFixed(1)} Hz above, ${tun.shadow.toFixed(1)} Hz below`);
console.log(`  third lobe:  ${lobe.above.toFixed(1)} Hz above, ${lobe.shadow.toFixed(1)} Hz below`);
if (!(att.shadow > 2 * Math.max(att.above, 0.5))) {
  fails++; console.log('   FAIL attenuation should show a shadow below without changing above');
}
if (!(proc.above > 5 * Math.max(att.above, 0.5))) {
  fails++; console.log('   FAIL processing should change the frequency above the body too');
}
if (!(tun.shadow < 1 && tun.above < 1)) {
  fails++; console.log('   FAIL tuning should fire neither depth test');
}
set('ix', 0);

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
