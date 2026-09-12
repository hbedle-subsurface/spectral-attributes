/* ===========================================================================
   harness-07.js — open module 07 headless, drive every control, print readouts
   Run:  node harness-07.js     (needs: npm install jsdom)
   Every number quoted in module 07's prose must appear here.
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
const html = fs.readFileSync(path.resolve(__dirname, 'modules/blending.html'), 'utf8')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/seismic.js"></script>', '<script>' + seis + '</script>')
  .replace('<script src="../assets/spectral.js"></script>', '<script>' + spec + '</script>')
  .replace('<script src="../assets/volume.js"></script>', '<script>' + volume + '</script>')
  .replace('<script src="../assets/volpanels.js"></script>', '<script>' + volp + '</script>')
  .replace('<script src="../assets/strata.js"></script>', '<script>' + strata + '</script>');

let threwOnLoad = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://hbedle-subsurface.github.io/spectral-attributes/modules/blending.html',
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

function scale(s) { doc.querySelector(`#segScale button[data-s="${s}"]`).click(); }

console.log('\n=== STEP 1 · the blend against its three channels ===');
tab('p1'); set('fd', 30); scale('ind');
for (const t of [[26, 30, 34], [18, 30, 46], [12, 34, 78]]) {
  set('fr', t[0]); set('fg', t[1]); set('fb', t[2]);
  console.log(`  ${t.join(' / ').padStart(12)} Hz -> tunes ${read('s1t').padStart(14)}  ` +
    `blend lights ${read('s1blend').padStart(5)}  best single map ${read('s1best')}`);
}
set('fr', 26); set('fg', 30); set('fb', 34);
const bunched = parseFloat(read('s1blend'));
set('fr', 18); set('fg', 30); set('fb', 46);
const spread = parseFloat(read('s1blend')), bestOne = parseFloat(read('s1best'));
console.log(`  bunched together the blend lights ${bunched}%, spread apart ${spread}%, ` +
  `best single map ${bestOne}%`);
if (!(spread > bestOne)) { fails++; console.log('   FAIL the blend should beat the best single map'); }
if (!(spread > bunched)) { fails++; console.log('   FAIL spreading the frequencies should add coverage'); }

console.log('\n=== NOISE · coverage as the section gets noisier ===');
tab('p4'); set('fd', 30);
let prev = 101;
for (const nz of [0, 4, 12, 24]) {
  set('noise', nz);
  const cov = parseFloat(read('s4yours'));
  console.log(`  noise ${String(nz).padStart(2)}% -> the three combined cover ${String(cov).padStart(5)}%`);
  if (cov > prev + 1) {
    fails++; console.log(`   FAIL noise ${nz}% covered more (${cov}) than a quieter section (${prev})`);
  }
  prev = cov;
}
set('noise', 4);

console.log('\n=== STEP 2 · the color legend, measured ===');
tab('p2');
/* A component tuned to fill thicker than anything in the model cannot peak at
   its own tuning thickness — it peaks at the thickest fill that is actually
   there. Find that ceiling by asking for a component tuned far outside the
   range, then judge the rest against it. */
set('fr', 10); set('fg', 30); set('fb', 46);
const CAP = parseFloat(read('s2r'));
console.log(`  a 10 Hz component tunes to 50.0 ms and peaks at ${CAP.toFixed(1)} ms — ` +
  `the thickest fill the model has enough of`);
for (const t of [[18, 30, 46], [14, 26, 50]]) {
  set('fr', t[0]); set('fg', t[1]); set('fb', t[2]);
  console.log(`  ${t.join(' / ')} Hz -> reddest at ${read('s2r').padStart(8)}  ` +
    `greenest ${read('s2g').padStart(8)}  bluest ${read('s2b').padStart(8)}  ` +
    `dark bins ${read('s2dark')}`);
  /* Each peak lands near that component's tuning thickness, 1/(2f) — but only
     where the model actually has fill that thick. The channel tops out at 34 ms,
     so a component tuned to something thicker peaks at the thickest fill
     present rather than at its own tuning thickness. */
  const cap = CAP + 1;
  for (const [lab, id, f] of [['reddest', 's2r', t[0]], ['greenest', 's2g', t[1]],
                              ['bluest', 's2b', t[2]]]) {
    expect(`${lab} near 1/(2*${f})`, read(id), Math.min(1000 / (2 * f), cap), 6);
  }
}
set('fr', 18); set('fg', 30); set('fb', 46);
const rT = parseFloat(read('s2r')), bT = parseFloat(read('s2b'));
if (!(rT > bT)) { fails++; console.log('   FAIL red should mark thicker fill than blue'); }
/* The three figures the step 2 finding quotes, held to a tolerance tight enough
   to catch a wrong one. The loose 6 ms check above tests the physics; this tests
   the prose. A 1 ms slip here once put the 14/26/50 Hz blue value in the
   18/30/46 Hz sentence. */
expect('reddest, as quoted in step 2', read('s2r'), 22.5, 0.6);
expect('greenest, as quoted in step 2', read('s2g'), 15.5, 0.6);
expect('bluest, as quoted in step 2', read('s2b'), 11.5, 0.6);

console.log('\n=== STEP 3 · the scaling choice ===');
tab('p3');
for (const t of [[18, 30, 46], [12, 30, 70]]) {
  set('fr', t[0]); set('fg', t[1]); set('fb', t[2]);
  console.log(`  ${t.join(' / ').padStart(12)} Hz -> raw energy ${read('s3raw')}  ` +
    `lit: scale-each ${read('s3li').padStart(5)}  one-scale ${read('s3lc')}`);
}
set('fr', 12); set('fg', 30); set('fb', 70);
const raw = read('s3raw'), li = parseFloat(read('s3li')), lc = parseFloat(read('s3lc'));
console.log(`  with components at 12/30/70 Hz the raw energies are ${raw}, ` +
  `and coverage goes ${li}% independent vs ${lc}% common`);
if (!(li > lc)) { fails++; console.log('   FAIL independent scaling should light more of the channel'); }
/* The energy ratio the step 3 finding quotes, component by component. */
const rawParts = raw.split(':').map((v) => parseFloat(v));
expect('raw energy, red', rawParts[0], 0.39, 0.03);
expect('raw energy, green', rawParts[1], 1.00, 0.03);
expect('raw energy, blue', rawParts[2], 0.10, 0.03);
set('fr', 18); set('fg', 30); set('fb', 46);

console.log('\n=== STEP 4 · which three frequencies ===');
tab('p4');
for (const f of [22, 30, 40]) {
  set('fd', f);
  console.log(`  wavelet ${String(f).padStart(2)} Hz -> best single ${read('s4best').padStart(7)} ` +
    `at ${read('s4bestv').padStart(5)}  your three ${read('s4yours').padStart(5)}  ` +
    `evenly spaced ${read('s4even')}`);
}
set('fd', 30);
const yours = parseFloat(read('s4yours')), even = parseFloat(read('s4even'));
const bestSingle = parseFloat(read('s4bestv'));
console.log(`  chosen three ${yours}% vs evenly spaced ${even}% vs best single frequency ${bestSingle}%`);
if (!(yours > bestSingle)) { fails++; console.log('   FAIL three chosen frequencies should beat one'); }
/* The two coverage figures the step 4 finding quotes, at the page defaults. */
expect('best single frequency coverage, as quoted', bestSingle, 68, 1);
expect('three together, as quoted', yours, 88, 1);
/* The widest spread scores HIGHEST on coverage, which is step 3's scaling
   effect rather than a real advantage: its outer components carry the least
   energy and gain the most from being stretched to full brightness. */
if (!(even > yours)) {
  fails++; console.log('   FAIL the wide default was expected to score higher on this biased metric');
}

console.log('\n=== STEP 5 · hue-lightness against raw peak frequency ===');
tab('p5');
for (const f of [24, 30, 40]) {
  set('fd', f);
  console.log(`  wavelet ${String(f).padStart(2)} Hz -> colored area ${read('s5area').padStart(5)}  ` +
    `of that on channel ${read('s5on').padStart(5)}  ` +
    `channel share of whole map ${read('s5raw').padStart(5)}  off-channel darkened ${read('s5dark')}`);
}
set('fd', 30);
const onMod = parseFloat(read('s5on')), onRaw = parseFloat(read('s5raw'));
console.log(`  the modulated display is ${onMod}% channel where it shows color; ` +
  `the unmodulated map is colored everywhere and is ${onRaw}% channel`);
if (!(onMod > onRaw)) { fails++; console.log('   FAIL modulation should raise the on-channel share'); }

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
