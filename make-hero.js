/* ===========================================================================
   make-hero.js — the landing page hero image

   Run: node make-hero.js        (rewrites the <div class="hero-panel"> block
                                  inside index.html, in place)

   The hero was a copy of the module 00 card thumbnail: two small grey channel
   panels at 300 x 96, the same picture a reader meets again forty pixels
   further down the page. This builds a proper one — the RGB blend, which is the
   image the whole subject is known by, at a size worth looking at, with the
   three components that make it shown beneath.

   Like the card thumbnails, every rectangle here is computed from
   assets/seismic.js rather than drawn by hand, so the hero cannot end up
   showing something the modules contradict.
   =========================================================================== */

const fs = require('fs');
const vm = require('vm');

function load(path, name) {
  const src = fs.readFileSync(path, 'utf8') + `\nglobalThis.${name} = ${name};`;
  vm.runInThisContext(src, { filename: path });
}
load('./assets/seismic.js', 'SEIS');

const W = 640, H = 400;
const SLATE = '#5C6670', CRIM = '#841617';
const NX = 64, NY = 52;                 // grid for the blend
const T0 = 0.10, DT = 0.001, NW = 220;
const RTOP = 0.1, RBOT = -0.1;

/* --- the channel: a sinuous axis, thinning to the margins and downstream --- */
function thickness() {
  const g = new Float64Array(NX * NY);
  for (let iy = 0; iy < NY; iy++) {
    const v = iy / (NY - 1);
    const axis = 0.5 + 0.26 * Math.sin(v * Math.PI * 2.1) * Math.cos(v * 1.7);
    const halfW = 0.15;
    const taper = 1 - 0.45 * v;                       // thinner downstream
    for (let ix = 0; ix < NX; ix++) {
      const u = ix / (NX - 1);
      const d = Math.abs(u - axis) / halfW;
      g[iy * NX + ix] = d >= 1 ? 0
        : 0.040 * taper * 0.5 * (1 + Math.cos(Math.PI * d));
    }
  }
  return g;
}

/* --- amplitude of one frequency component at one point -------------------- */
function isoMap(g, wav, f) {
  const out = new Float64Array(NX * NY);
  for (let i = 0; i < out.length; i++) {
    const T = g[i];
    if (T <= 0) { out[i] = 0; continue; }
    let re = 0, im = 0;
    for (let k = 0; k < NW; k++) {
      const t = k * DT;
      const hann = 0.5 * (1 - Math.cos(2 * Math.PI * k / (NW - 1)));
      const v = (RTOP * wav.fn(t - T0) + RBOT * wav.fn(t - (T0 + T))) * hann;
      const a = 2 * Math.PI * f * t;
      re += v * Math.cos(a); im -= v * Math.sin(a);
    }
    out[i] = Math.hypot(re, im);
  }
  return out;
}

const maxOf = (a) => { let m = 0; for (const v of a) m = Math.max(m, v); return m; };

/* --- draw a map as merged rects, in one colour channel or in RGB ---------
   A rect per grid cell came to 7,835 rects and 568 KB of SVG for a landing
   page, which is not a hero image, it is a download. Quantising each channel to
   a small number of levels and then merging runs of identical colour — the same
   approach make-thumbs.js uses for the cards — brings it down by more than an
   order of magnitude with no visible difference. */
const LEVELS = 7;
const q = (v) => Math.round(Math.max(0, Math.min(1, v)) * (LEVELS - 1)) / (LEVELS - 1);

const hex = (r, g, b) => '#' +
  [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function colorGrid(maps, mode) {
  const [r, g, b] = maps;
  const mr = maxOf(r) || 1, mg = maxOf(g) || 1, mb = maxOf(b) || 1;
  const grid = [];
  for (let ix = 0; ix < NX; ix++) {
    const col = new Array(NY);
    for (let iy = 0; iy < NY; iy++) {
      const i = iy * NX + ix;
      const vr = q(r[i] / mr), vg = q(g[i] / mg), vb = q(b[i] / mb);
      if (mode === 'rgb') {
        col[iy] = (vr < 0.06 && vg < 0.06 && vb < 0.06) ? null
          : hex(255 * vr, 255 * vg, 255 * vb);
      } else {
        const v = mode === 0 ? vr : mode === 1 ? vg : vb;
        const u = Math.round(255 * v);
        col[iy] = v < 0.06 ? null
          : mode === 0 ? hex(u, 0, 0) : mode === 1 ? hex(0, u, 0) : hex(0, 0, u);
      }
    }
    grid.push(col);
  }
  return grid;
}

/* Merge each run of identical colour along a row, then push it down while every
   cell below matches. Lifted from make-thumbs.js. */
function mergedRects(grid, x0, y0, w, h) {
  const nx = grid.length, ny = grid[0].length;
  const cw = w / nx, ch = h / ny;
  const done = grid.map(() => new Uint8Array(ny));
  const n = (v) => Math.round(v * 10) / 10;
  let out = '';
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (done[i][j] || grid[i][j] == null) continue;
      const c = grid[i][j];
      let k = i;
      while (k + 1 < nx && !done[k + 1][j] && grid[k + 1][j] === c) k++;
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

/* step decimates the grid. The three single-hue panels are 212 px wide on
   screen and do not need the full grid; the blend does. */
function paint(maps, x0, y0, w, h, mode, step) {
  let grid = colorGrid(maps, mode);
  if (step && step > 1) {
    const g2 = [];
    for (let i = 0; i < grid.length; i += step) {
      const col = [];
      for (let j = 0; j < grid[i].length; j += step) col.push(grid[i][j]);
      g2.push(col);
    }
    grid = g2;
  }
  return mergedRects(grid, x0, y0, w, h);
}

const wav = SEIS.makeWavelet({ type: 'ricker', f: 30 });
const g = thickness();
const FR = 18, FG = 32, FB = 52;
const maps = [isoMap(g, wav, FR), isoMap(g, wav, FG), isoMap(g, wav, FB)];

const lab = (x, y, t, fill) =>
  `<text x="${x}" y="${y}" font-family="IBM Plex Mono, monospace" font-size="11" ` +
  `fill="${fill}">${t}</text>`;

let body = `<rect width="${W}" height="${H}" fill="#0d1014"/>`;

// the blend, large
body += paint(maps, 16, 30, 380, 300, 'rgb');
body += `<rect x="16" y="30" width="380" height="300" fill="none" stroke="rgba(255,255,255,.14)"/>`;
body += lab(16, 22, `${FR} / ${FG} / ${FB} Hz blended`, '#E2E6EA');

// the three components that make it, stacked down the right
const sx = 412, sw = 212, sh = 92;
[[0, FR, 'red'], [1, FG, 'green'], [2, FB, 'blue']].forEach(([m, f], k) => {
  const y = 30 + k * (sh + 14);
  body += paint(maps, sx, y, sw, sh, m, 2);
  body += `<rect x="${sx}" y="${y}" width="${sw}" height="${sh}" fill="none" stroke="rgba(255,255,255,.14)"/>`;
  body += lab(sx + 5, y + 14, `${f} Hz`, '#E2E6EA');
});

body += lab(16, 350, 'one channel, three frequencies, one image', SLATE);
body += lab(16, 366, 'every pixel computed from the model on the page', SLATE);
body += `<line x1="16" y1="374" x2="${W - 16}" y2="374" stroke="${CRIM}" stroke-width="2"/>`;

const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" ` +
  `aria-label="A channel imaged at three frequencies and the three combined as an RGB blend">` +
  body + `</svg>`;

const p = 'index.html';
let s = fs.readFileSync(p, 'utf8');
const re = /<div class="hero-panel">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/;
if (!re.test(s)) { console.error('hero-panel block not found'); process.exit(1); }
s = s.replace(re,
  `<div class="hero-panel">\n        ${svg}\n` +
  `        <div class="hero-cap"><span>one channel at three frequencies</span>` +
  `<b>${FR} / ${FG} / ${FB} Hz</b></div>\n      </div>\n    </div>\n  </section>`);
fs.writeFileSync(p, s);
console.log(`hero written: ${svg.length} chars, ${(svg.match(/<rect/g) || []).length} rects`);
