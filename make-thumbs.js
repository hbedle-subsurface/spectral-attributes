/* ===========================================================================
   make-thumbs.js — the ten card illustrations on the landing page

   Run: node make-thumbs.js          (rewrites the <div class="thumb"> blocks
                                      inside index.html, in place)

   These are not decoration and they are not drawn by hand. Every path in every
   thumbnail is computed from assets/seismic.js and assets/spectral.js, using
   the same functions the modules use, so a card cannot end up showing something
   the module contradicts. If the physics changes, re-run this and the artwork
   follows.

   Output is inline SVG at viewBox 0 0 300 96, which is the height the .thumb
   and .card.planned rules in style.css already assume. No image files, so the
   "nothing leaves the machine, no stored pictures" rule still holds and the
   site still works from a local copy.
   =========================================================================== */

const fs = require('fs');
const vm = require('vm');

function load(path, name) {
  const src = fs.readFileSync(path, 'utf8') + `\nglobalThis.${name} = ${name};`;
  vm.runInThisContext(src, { filename: path });
}
load('./assets/seismic.js', 'SEIS');
load('./assets/spectral.js', 'SPEC');

const W = 300, H = 96;
const INK = '#16191C', CRIM = '#841617', TEAL = '#0B7285', SLATE = '#5C6670';
const FAINT = 'rgba(22,25,28,.16)';

const n = (v) => (Math.round(v * 10) / 10);
function poly(pts, stroke, width, fill) {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join(' ');
  return `<path d="${d}"${fill ? ` fill="${fill}"` : ' fill="none"'} stroke="${stroke}" ` +
    `stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}
function area(pts, y0, fill) {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join(' ');
  return `<path d="${d} L${n(pts[pts.length - 1][0])} ${n(y0)} L${n(pts[0][0])} ${n(y0)} Z" ` +
    `fill="${fill}" stroke="none"/>`;
}
function svg(body) {
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-hidden="true" focusable="false">${body}</svg>`;
}
const hex2 = (v) => v.toString(16).padStart(2, '0');
const mono = (t) => {
  // cream to crimson, the set's single-attribute ramp
  const c0 = [245, 236, 235], c1 = [132, 22, 23];
  const v = c0.map((a, i) => Math.round(a + (c1[i] - a) * t));
  return '#' + v.map(hex2).join('');
};


/* Emit a grid of colored cells as SVG rectangles, merging equal neighbours in
   BOTH directions. Colors are quantized first; without the merge and the
   quantization the time-frequency panels and the blend produce several thousand
   one-cell rectangles each and the landing page grows past half a megabyte.
   Merging vertically as well as horizontally is what lets the blend use a grid
   fine enough that the channel edge stops aliasing into a row of dark blocks.

   grid is indexed [x][y] with y already running top to bottom, and holds either
   a color string or null for "leave the background showing". */
function rects(grid, x0, y0, w, h) {
  const nx = grid.length, ny = grid[0].length;
  const cw = w / nx, ch = h / ny;
  const done = grid.map(() => new Uint8Array(ny));
  let out = '';
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (done[i][j] || grid[i][j] == null) continue;
      const c = grid[i][j];
      // widest run of this color on this row
      let k = i;
      while (k + 1 < nx && !done[k + 1][j] && grid[k + 1][j] === c) k++;
      // then push that run down while every cell below matches
      let m = j;
      for (;;) {
        const next = m + 1;
        if (next >= ny) break;
        let ok = true;
        for (let x = i; x <= k && ok; x++) if (done[x][next] || grid[x][next] !== c) ok = false;
        if (!ok) break;
        m = next;
      }
      for (let x = i; x <= k; x++) for (let y = j; y <= m; y++) done[x][y] = 1;
      out += `<rect x="${n(x0 + i * cw)}" y="${n(y0 + j * ch)}" ` +
        `width="${n((k - i + 1) * cw + 0.4)}" height="${n((m - j + 1) * ch + 0.4)}" fill="${c}"/>`;
      i = k;
    }
  }
  return out;
}

/* A scalar field on the set's single-attribute ramp. cols is indexed [x][y]
   with y running BOTTOM to top, which is how the time-frequency panels are
   built, so it is flipped here rather than at every call site. */
function field(cols, x0, y0, w, h, colorOf, cutoff) {
  const cut = cutoff == null ? 0.04 : cutoff;
  const q = (t) => Math.round(Math.max(0, Math.min(1, t)) * 9) / 9;
  const grid = cols.map((col) => {
    const out = new Array(col.length);
    for (let j = 0; j < col.length; j++) {
      const v = q(col[col.length - 1 - j]);
      out[j] = v <= cut ? null : colorOf(v);
    }
    return out;
  });
  return rects(grid, x0, y0, w, h);
}

/* --- a channel, shared by the cards that show one ----------------------- */
function channelFill(x, opts) {
  // x in 0..1 along the channel; returns fill thickness in seconds
  const o = opts || {};
  const maxT = o.maxT || 0.034, width = o.width || 0.62, thin = o.thin || 0.45;
  const axis = 0.5 + 0.16 * Math.sin(x * 4.2);
  return (u) => {
    const d = Math.abs(u - axis) / (width / 2);
    if (d >= 1) return 0;
    return maxT * (1 - x * thin) * Math.sqrt(1 - d * d);
  };
}
function channelGrid(nx, nu, opts) {
  const g = [];
  for (let i = 0; i < nx; i++) {
    const f = channelFill(i / (nx - 1), opts);
    const row = [];
    for (let j = 0; j < nu; j++) row.push(f(j / (nu - 1)));
    g.push(row);
  }
  return g;
}
// response of a doublet of thickness T at frequency f, and broadband peak amp
const isoAmp = (T, f) => (T > 0 ? SPEC.doubletSpectrum(f, T) : 0);

function channelPanel(x0, y0, w, h, f, opts) {
  const nx = 24, nu = 14;
  const g = channelGrid(nx, nu, opts);
  let mx = 1e-9;
  const a = g.map((row) => row.map((T) => { const v = isoAmp(T, f); if (v > mx) mx = v; return v; }));
  const cols = a.map((row) => row.map((v) => v / mx));
  return field(cols, x0, y0, w, h, mono, 0.05);
}

/* ======================================================================= */
const thumbs = {};

/* --- 00 · why: the same channel at two frequencies ---------------------- */
{
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  b += channelPanel(6, 10, 138, 76, 18);
  b += channelPanel(156, 10, 138, 76, 52);
  b += `<rect x="6" y="10" width="138" height="76" fill="none" stroke="${FAINT}"/>`;
  b += `<rect x="156" y="10" width="138" height="76" fill="none" stroke="${FAINT}"/>`;
  b += `<text x="10" y="8" font-family="IBM Plex Mono, monospace" font-size="7.5" ` +
    `fill="${SLATE}">18 Hz</text>`;
  b += `<text x="160" y="8" font-family="IBM Plex Mono, monospace" font-size="7.5" ` +
    `fill="${SLATE}">52 Hz</text>`;
  thumbs['00'] = svg(b);
}

/* --- 01 · spectrum: a wavelet and its spectrum -------------------------- */
{
  const wav = SEIS.makeWavelet({ type: 'ricker', f: 30 });
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const t = -0.06 + (0.12 * i) / 120;
    pts.push([8 + (i / 120) * 130, 48 - wav.fn(t) * 34]);
  }
  const sp = [];
  for (let i = 0; i <= 100; i++) {
    const f = (i / 100) * 90;
    sp.push([162 + (i / 100) * 130, 84 - SPEC.rickerSpectrum(f, 30) / 0.4153 * 62]);
  }
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  b += `<line x1="8" y1="48" x2="138" y2="48" stroke="${FAINT}" stroke-width="1"/>`;
  b += poly(pts, INK, 1.6);
  b += `<line x1="162" y1="84" x2="292" y2="84" stroke="${FAINT}" stroke-width="1"/>`;
  b += area(sp, 84, 'rgba(11,114,133,.18)');
  b += poly(sp, TEAL, 1.6);
  b += `<line x1="${n(162 + (30 / 90) * 130)}" y1="22" x2="${n(162 + (30 / 90) * 130)}" ` +
    `y2="84" stroke="${CRIM}" stroke-width="1" stroke-dasharray="2 2"/>`;
  b += `<line x1="150" y1="12" x2="150" y2="84" stroke="${FAINT}" stroke-width="1"/>`;
  thumbs['01'] = svg(b);
}

/* --- 02 · windows: one trace, two window lengths ------------------------ */
{
  const dt = 0.001, nt = 512;
  const w1 = SEIS.makeWavelet({ type: 'ricker', f: 55 });
  const w2 = SEIS.makeWavelet({ type: 'ricker', f: 18 });
  const tr = new Float64Array(nt);
  for (let i = 0; i < nt; i++) {
    const t = i * dt;
    tr[i] = w1.fn(t - 0.13) + 0.9 * w2.fn(t - 0.36);
  }
  const pts = [];
  for (let i = 0; i < nt; i += 2) pts.push([8 + (i / (nt - 1)) * 284, 30 - tr[i] * 17]);
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  b += `<line x1="8" y1="30" x2="292" y2="30" stroke="${FAINT}"/>`;
  b += poly(pts, INK, 1.4);
  // two windows over the same data: short (good in time) and long (good in f)
  b += `<rect x="26" y="50" width="34" height="17" fill="rgba(132,22,23,.14)" stroke="${CRIM}" stroke-width="1"/>`;
  b += `<text x="66" y="63" font-family="IBM Plex Mono, monospace" font-size="7.5" fill="${CRIM}">short: when</text>`;
  b += `<rect x="26" y="72" width="132" height="17" fill="rgba(11,114,133,.14)" stroke="${TEAL}" stroke-width="1"/>`;
  b += `<text x="164" y="85" font-family="IBM Plex Mono, monospace" font-size="7.5" fill="${TEAL}">long: what</text>`;
  thumbs['02'] = svg(b);
}

/* --- 03 · components: the time-frequency plane -------------------------- */
{
  const dt = 0.001, nt = 400;
  const wa = SEIS.makeWavelet({ type: 'ricker', f: 45 });
  const wb = SEIS.makeWavelet({ type: 'ricker', f: 20 });
  const tr = new Float64Array(nt);
  for (let i = 0; i < nt; i++) {
    const t = i * dt;
    tr[i] = wa.fn(t - 0.11) + 0.85 * wb.fn(t - 0.28);
  }
  const freqs = [];
  for (let f = 6; f <= 80; f += 6) freqs.push(f);
  const tf = SPEC.cwt(tr, dt, freqs, { sigma: 1.0 });
  const step = 12;
  const cols = [];
  for (let i = 0; i < nt; i += step) cols.push(freqs.map((_, j) => tf.mag[j][i]));
  let mx = 1e-9;
  for (const c of cols) for (const v of c) mx = Math.max(mx, v);
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  b += field(cols.map((c) => c.map((v) => v / mx)), 8, 8, 284, 80, mono, 0.06);
  b += `<rect x="8" y="8" width="284" height="80" fill="none" stroke="${FAINT}"/>`;
  thumbs['03'] = svg(b);
}

/* --- 04 · tuning: the wedge, and the notch comb it makes ---------------- */
{
  const wav = SEIS.makeWavelet({ type: 'ricker', f: 30 });
  const w = SPEC.wedge({ nx: 40, dt: 0.001, nt: 260, t0: 0.05, maxThick: 0.046, wavelet: wav });
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  // the wedge as variable density, which is how module 04 draws it: the bright
  // band at tuning is the whole point and wiggle traces hide it at this size.
  const cols = [];
  for (let ix = 0; ix < w.nx; ix++) {
    const col = [];
    for (let i = 40; i < 200; i += 4) col.push(Math.abs(w.traces[ix][i]));
    cols.push(col.reverse());   // field() flips; this panel wants time downward
  }
  let wmx = 1e-9;
  for (const c of cols) for (const v of c) wmx = Math.max(wmx, v);
  b += field(cols.map((c) => c.map((v) => v / wmx)), 8, 10, 130, 76, mono, 0.05);
  b += `<rect x="8" y="10" width="130" height="76" fill="none" stroke="${FAINT}"/>`;
  // the comb of the thickest bed on the right
  const T = 0.024, sp = [];
  for (let i = 0; i <= 120; i++) {
    const f = (i / 120) * 130;
    sp.push([162 + (i / 120) * 130, 84 - SPEC.doubletSpectrum(f, T) * 30]);
  }
  b += `<line x1="162" y1="84" x2="292" y2="84" stroke="${FAINT}"/>`;
  b += area(sp, 84, 'rgba(11,114,133,.16)');
  b += poly(sp, TEAL, 1.5);
  const fn = 1 / T;
  if (fn <= 130) {
    const xn = 162 + (fn / 130) * 130;
    b += `<line x1="${n(xn)}" y1="66" x2="${n(xn)}" y2="88" stroke="${CRIM}" stroke-width="1"/>`;
    b += `<text x="${n(xn + 3)}" y="76" font-family="IBM Plex Mono, monospace" font-size="7.5" fill="${CRIM}">1/T</text>`;
  }
  b += `<line x1="150" y1="12" x2="150" y2="84" stroke="${FAINT}"/>`;
  thumbs['04'] = svg(b);
}

/* --- 05 · balancing: a spectrum before and after ------------------------ */
{
  const freqs = [];
  for (let f = 4; f <= 100; f += 1) freqs.push(f);
  const avg = freqs.map((f) => Math.exp(-0.5 * Math.pow((f - 33) / 13, 2)) + 0.02);
  const bal = SPEC.applyBalance(avg, SPEC.balanceOperator(avg, freqs, { alpha: 0.01, beta: 0 }));
  const mx0 = Math.max(...avg), mx1 = Math.max(...Array.from(bal));
  // Array.from first: .map on a Float64Array returns a Float64Array, so
  // returning a [x, y] pair from it silently becomes NaN.
  const P = (arr, mx) => Array.from(arr).map((v, j) =>
    [8 + (j / (arr.length - 1)) * 284, 86 - (v / mx) * 66]);
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  b += `<line x1="8" y1="86" x2="292" y2="86" stroke="${FAINT}"/>`;
  b += area(P(bal, mx1), 86, 'rgba(11,114,133,.14)');
  b += poly(P(bal, mx1), TEAL, 1.6);
  b += poly(P(avg, mx0), CRIM, 1.6);
  // label each curve at its own right-hand end, so the text can never land on
  // the other curve whatever the numbers do.
  const yb = P(bal, mx1), yr = P(avg, mx0);
  const endB = yb[yb.length - 1][1], endR = yr[yr.length - 1][1];
  b += `<text x="238" y="${n(endB - 5)}" font-family="IBM Plex Mono, monospace" ` +
    `font-size="7.5" fill="${TEAL}">after</text>`;
  b += `<text x="234" y="${n(endR - 5)}" font-family="IBM Plex Mono, monospace" ` +
    `font-size="7.5" fill="${CRIM}">before</text>`;
  thumbs['05'] = svg(b);
}

/* --- 06 · attributes: a spectrum reduced to two numbers ----------------- */
{
  const freqs = [];
  for (let f = 2; f <= 100; f += 0.5) freqs.push(f);
  const mag = freqs.map((f) => SPEC.doubletSpectrum(f, 0.021) * SPEC.rickerSpectrum(f, 32) / 0.4153);
  const st = SPEC.specStats(mag, freqs);
  const mx = Math.max(...mag);
  const pts = mag.map((v, j) => [8 + (j / (mag.length - 1)) * 200, 86 - (v / mx) * 64]);
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  b += `<line x1="8" y1="86" x2="208" y2="86" stroke="${FAINT}"/>`;
  b += area(pts, 86, 'rgba(22,25,28,.10)');
  b += poly(pts, INK, 1.5);
  const xp = 8 + ((st.peakFreq - 2) / 98) * 200;
  const yp = 86 - (mx / mx) * 64;
  b += `<line x1="${n(xp)}" y1="${n(yp)}" x2="${n(xp)}" y2="86" stroke="${CRIM}" stroke-width="1.2"/>`;
  b += `<circle cx="${n(xp)}" cy="${n(yp)}" r="2.6" fill="${CRIM}"/>`;
  b += `<line x1="8" y1="${n(yp)}" x2="${n(xp)}" y2="${n(yp)}" stroke="${TEAL}" ` +
    `stroke-width="1.2" stroke-dasharray="3 2"/>`;
  b += `<line x1="216" y1="20" x2="216" y2="86" stroke="${FAINT}"/>`;
  b += `<text x="224" y="34" font-family="IBM Plex Mono, monospace" font-size="8" fill="${CRIM}">peak</text>`;
  b += `<text x="224" y="45" font-family="IBM Plex Mono, monospace" font-size="8" fill="${CRIM}">freq</text>`;
  b += `<text x="224" y="64" font-family="IBM Plex Mono, monospace" font-size="8" fill="${TEAL}">peak</text>`;
  b += `<text x="224" y="75" font-family="IBM Plex Mono, monospace" font-size="8" fill="${TEAL}">mag</text>`;
  thumbs['06'] = svg(b);
}

/* --- 07 · blending: three iso-frequency maps stacked as layers ----------- */
{
  // Composited with SPEC.overlayPixel, the same call module 07 uses, so the
  // card cannot show a display model the module contradicts. Each map is a
  // layer painted over ink with an opacity equal to its own magnitude, so the
  // channel fades out into the background instead of ending at a contour.
  const nx = 46, nu = 30;
  const g = channelGrid(nx, nu, { maxT: 0.024 });
  const F = [20, 30, 45];
  const COLS = [[229, 57, 53], [67, 160, 71], [30, 136, 229]];
  const INK = [16, 19, 21];
  const resp = F.map((f) => g.map((row) => row.map((T) => isoAmp(T, f))));
  const mx = F.map((_, k) => Math.max(...resp[k].flat(), 1e-9));
  const q = (t) => Math.round(Math.max(0, Math.min(1, t)) * 7) / 7;
  // A mild gamma on each layer before quantizing. This is the per-layer
  // scaling module 07 step 3 is about, not a cosmetic trick: without it the
  // thin margins come back almost black and the channel looks narrower than
  // it is.
  const gam = (t) => Math.pow(Math.max(0, Math.min(1, t)), 0.6);
  const grid = [];
  for (let i = 0; i < nx; i++) {
    const col = [];
    for (let j = 0; j < nu; j++) {
      const v = [0, 1, 2].map((k) => q(gam(resp[k][i][j] / mx[k])));
      if (v[0] + v[1] + v[2] < 0.08) { col.push(null); continue; }
      const c = SPEC.overlayPixel(
        [0, 1, 2].map((k) => ({ value: v[k], color: COLS[k], opacity: 0.7 })), INK);
      col.push('#' + c.map((t) => hex2(Math.round(t))).join(''));
    }
    grid.push(col);
  }
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  b += `<rect x="8" y="8" width="284" height="80" fill="#101315"/>`;
  b += rects(grid, 8, 8, 284, 80);
  b += `<rect x="8" y="8" width="284" height="80" fill="none" stroke="${FAINT}"/>`;
  thumbs['07'] = svg(b);
}

/* --- 08 · methods: the same trace, three ways --------------------------- */
{
  const dt = 0.001, nt = 320;
  const wav = SEIS.makeWavelet({ type: 'ricker', f: 34 });
  const tr = new Float64Array(nt);
  for (let i = 0; i < nt; i++) {
    const t = i * dt;
    tr[i] = wav.fn(t - 0.10) - 0.8 * wav.fn(t - 0.126) + 0.7 * wav.fn(t - 0.24);
  }
  const freqs = [];
  for (let f = 6; f <= 80; f += 7) freqs.push(f);
  const tfs = [
    SPEC.stft(tr, dt, freqs, { winLen: 0.060, window: 'hann' }),
    SPEC.cwt(tr, dt, freqs, { sigma: 1.0 }),
    SPEC.cwt(tr, dt, freqs, { sigma: 1.0 }),
  ];
  const PW = 92, PH = 80, GAP = 8, step = 16;
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  tfs.forEach((tf, p) => {
    const X0 = 6 + p * (PW + GAP);
    const cols = [];
    for (let i = 0; i < nt; i += step) cols.push(freqs.map((_, j) => tf.mag[j][i]));
    let mx = 1e-9;
    for (const c of cols) for (const v of c) mx = Math.max(mx, v);
    // the third panel stands for the sparse method: same data, sharper picture
    const norm = cols.map((c) => c.map((v) => (p === 2 ? Math.pow(v / mx, 2.4) : v / mx)));
    b += field(norm, X0, 8, PW, PH, mono, 0.07);
    b += `<rect x="${X0}" y="8" width="${PW}" height="${PH}" fill="none" stroke="${FAINT}"/>`;
  });
  thumbs['08'] = svg(b);
}

/* --- 09 · shadows: peak frequency down two traces ----------------------- */
{
  const dt = 0.001;
  const f0 = 32;
  const times = [];
  for (let t = 0.05; t <= 0.75; t += 0.02) times.push(t);
  // through an absorbing body at 0.30 s: the peak drops and stays down
  const shadow = times.map((t) => {
    if (t < 0.30) return f0;
    const tt = 2 * (t - 0.30);
    // peak of a Ricker after exp(-pi f t / Q), solved in closed form
    const a = 1 / (f0 * f0), c = Math.PI * tt / 30;
    return (-c + Math.sqrt(c * c + 16 * a)) / (4 * a);
  });
  const tuned = times.map((t) => (t > 0.29 && t < 0.33 ? f0 - 7 : f0));
  const P = (arr) => arr.map((v, j) => [
    8 + (j / (arr.length - 1)) * 284,
    88 - ((v - 8) / (38 - 8)) * 74,
  ]);
  let b = `<rect width="${W}" height="${H}" fill="#F6F4EE"/>`;
  b += `<line x1="8" y1="${n(88 - ((f0 - 8) / 30) * 74)}" x2="292" ` +
    `y2="${n(88 - ((f0 - 8) / 30) * 74)}" stroke="${FAINT}" stroke-dasharray="3 3"/>`;
  const xb = 8 + ((0.30 - 0.05) / 0.70) * 284;
  b += `<line x1="${n(xb)}" y1="6" x2="${n(xb)}" y2="90" stroke="rgba(22,25,28,.22)"/>`;
  b += poly(P(tuned), TEAL, 1.6);
  b += poly(P(shadow), CRIM, 1.8);
  b += `<text x="${n(xb + 5)}" y="14" font-family="IBM Plex Mono, monospace" font-size="7.5" ` +
    `fill="${SLATE}">gas sand</text>`;
  thumbs['09'] = svg(b);
}

/* ================================================================= write */
/* Insertion is done by SPLITTING the file on card boundaries and editing each
   card in isolation. An earlier version used one regular expression per card
   over the whole file; the optional "existing thumb" group matched across a
   card boundary and deleted nine of the ten cards. Regexes do not respect
   structure, so the structure is imposed first. */
const SPLIT = '<article class="card">';
let html = fs.readFileSync('index.html', 'utf8');
const parts = html.split(SPLIT);
const head = parts.shift();

let done = 0;
const seen = [];
const out = parts.map((card) => {
  const m = card.match(/<p class="card-no">(\d\d)<\/p>/);
  if (!m) return card;
  const no = m[1];
  seen.push(no);
  if (!thumbs[no]) return card;
  // strip any thumb already present in THIS card only, then insert
  let c = card.replace(/^\s*<div class="thumb">[\s\S]*?<\/svg><\/div>\s*/, '\n        ');
  const at = c.indexOf('<div class="card-body">');
  if (at < 0) return card;
  done++;
  return c.slice(0, at) + `<div class="thumb">${thumbs[no]}</div>\n        ` + c.slice(at);
});

const result = head + out.map((c) => SPLIT + c).join('');

/* Refuse to write if the edit lost or gained a card. */
const before = (html.match(/<article class="card">/g) || []).length;
const after = (result.match(/<article class="card">/g) || []).length;
const bodies = (result.match(/<div class="card-body">/g) || []).length;
if (before !== after || bodies !== before) {
  console.error(`ABORTED: cards ${before} -> ${after}, bodies ${bodies}. index.html untouched.`);
  process.exit(1);
}
fs.writeFileSync('index.html', result);
console.log(`wrote ${done} thumbnails into ${after} cards (${seen.join(', ')})`);
