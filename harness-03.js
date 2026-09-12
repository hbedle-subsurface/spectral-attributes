/* ===========================================================================
   harness-03.js — open module 03 headless, drive every control, print readouts
   Run:  node harness-03.js     (needs: npm install jsdom)
   Every number quoted in module 03's prose must appear here.
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
const html = fs.readFileSync(path.resolve(__dirname, 'modules/components.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/components.html',
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
function grid(g) { doc.querySelector(`#segGrid button[data-g="${g}"]`).click(); }

let fails = 0;
function expect(label, got, want, tol) {
  const g = parseFloat(got), w = parseFloat(want);
  if (!(Math.abs(g - w) <= tol)) { fails++; console.log(`   FAIL ${label}: page says ${got}, prose says ${want}`); }
}

console.log('\n=== STEP 1 · a voice is a narrow bandpass ===');
tab('p1');
for (const f of [10, 20, 35, 50, 80]) {
  set('fc', f);
  console.log(`  ${String(f).padStart(2)} Hz -> filter bandwidth ${read('s1bw')}  ` +
    `voice peak ${read('s1amp')}  fraction of trace ${read('s1frac')}`);
}
// the filter bandwidth must be proportional to frequency: that is what makes it
// a wavelet transform rather than a fixed window
const bws = [];
for (const f of [20, 40, 80]) { set('fc', f); bws.push(parseFloat(read('s1bw'))); }
console.log(`  bandwidth 20/40/80 Hz -> ${bws.map((v) => v.toFixed(1)).join(', ')} Hz ` +
  `(ratios ${(bws[1] / bws[0]).toFixed(2)}, ${(bws[2] / bws[1]).toFixed(2)})`);
expect('bandwidth doubles with frequency (40/20)', bws[1] / bws[0], 2, 0.05);
expect('bandwidth doubles with frequency (80/40)', bws[2] / bws[1], 2, 0.05);
expect('bandwidth at 20 Hz', bws[0], 5.3, 0.2);
expect('bandwidth at 80 Hz', bws[2], 21.2, 0.4);
set('fc', 30);

console.log('\n=== STEP 2 · voice = magnitude x cos(phase) ===');
tab('p2');
for (const ix of [10, 40, 60, 90]) {
  set('ix', ix);
  const v = read('s2v'), c = read('s2chk');
  console.log(`  trace ${String(ix).padStart(2)} -> mag ${read('s2mag')}  phase ${read('s2ph')}  ` +
    `voice ${v}  mag*cos ${c}`);
  expect(`identity holds at trace ${ix}`, parseFloat(v), parseFloat(c), 1e-4);
}
set('ix', 60);

console.log('\n=== STEP 3 · the traveltime correction ===');
tab('p3');
for (const f of [20, 40, 60]) {
  set('fc', f);
  console.log(`  ${String(f).padStart(2)} Hz -> raw wraps/100 ms ${read('s3wrap')}  ` +
    `corrected ${read('s3wrapc')}`);
}
/* A raw phase panel wraps roughly once per cycle, so the count tracks the
   frequency in cycles per 100 ms — but it sits a little under at the top of the
   band, because the filter passes more energy from below its center frequency
   than above it, where this trace actually has content. */
const wrapWant = { 20: 2.2, 40: 4.2, 60: 5.1 };
for (const f of [20, 40, 60]) {
  set('fc', f);
  expect(`raw wraps at ${f} Hz`, read('s3wrap'), wrapWant[f], 0.35);
  const raw = parseFloat(read('s3wrap')), cor = parseFloat(read('s3wrapc'));
  if (!(cor < raw / 2)) { fails++; console.log(`   FAIL correction barely reduced wrapping at ${f} Hz`); }
}
set('fc', 30);

console.log('\n=== STEP 4 · each frequency finds its own bed ===');
tab('p4'); set('thick', 40);
const iso = [];
for (const f of [15, 25, 40, 60]) {
  set('fc', f);
  const tr = parseInt(read('s4tr'), 10);
  const th = parseFloat(read('s4th'));
  const pred = parseFloat(read('s4pred'));
  iso.push({ f, tr, th, pred });
  console.log(`  ${String(f).padStart(2)} Hz -> brightest at trace ${String(tr).padStart(2)}  ` +
    `thickness there ${th.toFixed(1)} ms  vs 1/(2f) = ${pred.toFixed(1)} ms`);
}
// the bright zone must march toward the thin end as frequency rises
for (let i = 1; i < iso.length; i++) {
  if (!(iso[i].tr >= iso[i - 1].tr)) {
    fails++; console.log(`   FAIL the bright zone moved the wrong way at ${iso[i].f} Hz`);
  }
}
if (!(iso[0].th > iso[iso.length - 1].th)) {
  fails++; console.log('   FAIL thickness at the bright zone did not fall with frequency');
}
set('fc', 30);

console.log('\n=== STEP 5 · voices only sum on the right grid ===');
tab('p5');
for (const g of ['linear', 'log']) {
  grid(g);
  console.log(`  ${g.padEnd(6)} -> ${read('s5n')} components  ripple ${read('s5rip')}  ` +
    `match ${read('s5fit')}`);
}
grid('linear'); const rl = parseFloat(read('s5rip')), fl = parseFloat(read('s5fit'));
grid('log');    const rg = parseFloat(read('s5rip')), fg = parseFloat(read('s5fit'));
console.log(`  ripple ${rl}% -> ${rg}%, match ${fl}% -> ${fg}%`);
if (!(rg < rl / 3)) { fails++; console.log('   FAIL the per-octave grid should be far flatter'); }
if (!(fg > fl)) { fails++; console.log('   FAIL the per-octave grid should reconstruct better'); }
grid('linear'); expect('linear ripple', rl, 106, 6); expect('linear match', fl, 75.7, 2);
grid('log');    expect('log ripple', rg, 4, 2);     expect('log match', fg, 99.2, 1);
for (const t of [[15, 21, 31.5], [25, 51, 19.4], [40, 67, 12.9], [60, 76, 9.3]]) {
  tab('p4'); set('fc', t[0]);
  expect(`bright trace at ${t[0]} Hz`, read('s4tr'), t[1], 3);
  expect(`thickness there at ${t[0]} Hz`, read('s4th'), t[2], 1.2);
}
tab('p5');

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
