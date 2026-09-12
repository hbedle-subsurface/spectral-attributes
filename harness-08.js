/* ===========================================================================
   harness-08.js — open module 08 headless, drive every control, print readouts
   Run:  node harness-08.js     (needs: npm install jsdom)
   Every number quoted in module 08's prose must appear here.
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
const html = fs.readFileSync(path.resolve(__dirname, 'modules/methods.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/methods.html',
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

console.log('\n=== STEP 1 · three decompositions of one trace ===');
tab('p1'); set('fd', 30); set('noise', 3); set('win', 60); set('sep', 28);
for (const b of [30, 20, 14, 8]) {
  set('bed', b);
  console.log(`  bed ${String(b).padStart(2)} ms -> predicted ${read('s1p').padStart(9)}  ` +
    `STFT ${read('s1a').padStart(9)}  wavelet ${read('s1b').padStart(9)}  ` +
    `matching pursuit ${read('s1c')}`);
}
// the three methods should spread apart as the bed thins
const spreadAt = (b) => {
  set('bed', b);
  const v = [read('s1a'), read('s1b'), read('s1c')].map(parseFloat).filter(isFinite);
  return Math.max(...v) - Math.min(...v);
};
const sThick = spreadAt(30), sThin = spreadAt(8);
console.log(`  spread between methods: ${sThick.toFixed(1)} Hz on a 30 ms bed, ` +
  `${sThin.toFixed(1)} Hz on an 8 ms bed`);
/* The methods CONVERGE on the thin bed, because none of them can see the tuning
   peak any more and all three fall back on the wavelet. Agreement here is not
   evidence of accuracy. */
expect('spread on a 30 ms bed', sThick, 12.6, 1.5);
expect('spread on an 8 ms bed', sThin, 5.3, 1.5);
if (!(sThin < sThick)) { fails++; console.log('   FAIL the methods should converge on the thin bed'); }
set('bed', 8);
for (const id of ['s1a', 's1b', 's1c']) {
  const v = parseFloat(read(id));
  if (Math.abs(v - 62.5) < 15) { fails++; console.log(`   FAIL ${id} should have saturated well below 62.5 Hz`); }
}
set('bed', 14);

console.log('\n=== STEP 2 · fixed window against constant Q ===');
tab('p2');
for (const w of [40, 60, 120]) {
  set('win', w);
  console.log(`  window ${String(w).padStart(3)} ms -> STFT length ${read('s2s').padStart(16)}  ` +
    `wavelet length ${read('s2w').padStart(16)}`);
}
set('win', 60);
console.log(`  frequency resolution at 20 and 60 Hz: STFT ${read('s2sf')}, wavelet ${read('s2wf')}`);
// the wavelet family must shorten with frequency; the fixed window must not
const wl = read('s2w').match(/[\d.]+/g).map(Number);
const sl = read('s2s').match(/[\d.]+/g).map(Number);
if (!(wl[1] < wl[0])) { fails++; console.log('   FAIL the wavelet family should shorten at high frequency'); }
if (!(Math.abs(sl[1] - sl[0]) < 0.01)) { fails++; console.log('   FAIL the fixed window should not change'); }

console.log('\n=== STEP 3 · beating the bound, and breaking it ===');
tab('p3');
for (const g of [4, 8, 16, 30]) {
  set('gap', g);
  console.log(`  tones ${String(g).padStart(2)} Hz apart (limit ${read('s3lim')}) -> ` +
    `Fourier peaks ${read('s3fp')}  sparse peaks ${read('s3sp')}  ` +
    `sparse peaks on a broadband event ${read('s3bb')}`);
}
set('gap', 8);
const fp = parseInt(read('s3fp'), 10), sp = parseInt(read('s3sp'), 10), bb = parseInt(read('s3bb'), 10);
console.log(`  at 8 Hz separation, well inside the ${read('s3lim')} limit: ` +
  `Fourier finds ${fp}, the sparse solver finds ${sp}`);
if (!(fp === 1)) { fails++; console.log('   FAIL the Fourier transform should not resolve them'); }
if (!(sp === 2)) { fails++; console.log('   FAIL the sparse solver should resolve them'); }
console.log(`  on a single broadband wavelet the same solver reports ${bb} peaks`);
if (!(bb > 1)) { fails++; console.log('   FAIL the sparse solver should split a broadband event'); }

console.log('\n=== STEP 4 · matching pursuit at and below tuning ===');
tab('p4');
for (const b of [40, 30, 20, 14, 8, 4]) {
  set('bed', b);
  console.log(`  bed ${String(b).padStart(2)} ms -> atoms ${read('s4n').padStart(3)}  ` +
    `residual ${read('s4r').padStart(7)}  atoms near the bed ${read('s4b')}  ` +
    `first atom ${read('s4f')}`);
}
set('bed', 40); const nThick = parseInt(read('s4b'), 10), rThick = parseFloat(read('s4r'));
set('bed', 6);  const nThin = parseInt(read('s4b'), 10), rThin = parseFloat(read('s4r'));
console.log(`  near the bed: ${nThick} atoms at 40 ms, ${nThin} at 6 ms; ` +
  `residual ${rThick.toFixed(1)}% then ${rThin.toFixed(1)}%`);
expect('atoms near a 40 ms bed', nThick, 3, 0.5);
expect('residual on a 40 ms bed', rThick, 0.6, 0.4);
expect('residual on a 6 ms bed', rThin, 2.6, 0.6);
if (!(nThin < nThick)) { fails++; console.log('   FAIL a thin bed should be fitted with fewer atoms'); }
if (!(rThin > rThick)) { fails++; console.log('   FAIL the residual should be worse below tuning'); }
set('bed', 14);

console.log('\n=== STEP 5 · the same measurement, three ways ===');
tab('p5');
for (const f of [24, 30, 40]) {
  set('fd', f);
  console.log(`  wavelet ${String(f).padStart(2)} Hz -> mean error: STFT ${read('s5a').padStart(5)}  ` +
    `wavelet ${read('s5b').padStart(5)}  matching pursuit ${read('s5c').padStart(5)}  ` +
    `largest disagreement ${read('s5d')}`);
}
set('fd', 30);
console.log(`  at 30 Hz the three disagree most by ${read('s5d')}`);
expect('STFT mean error', read('s5a'), 25, 3);
expect('wavelet mean error', read('s5b'), 35, 4);
expect('matching pursuit mean error', read('s5c'), 37, 5);
const dis = read('s5d').match(/[\d.]+/g).map(Number);
expect('largest disagreement', dis[0], 23.4, 3);
expect('and where it falls', dis[1], 34, 4);

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
