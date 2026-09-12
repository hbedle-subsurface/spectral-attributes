/* ===========================================================================
   verify-axes.js — do the axis labels point the same way as the data?

   Run: node verify-axes.js

   This exists because they did not. SEIS.axisLeft used to place min at the TOP
   unless a caller passed { flip: true }, and no caller ever did, while every
   curve in the set is drawn with the standard mapping

       y = rect.y + rect.h - fraction * rect.h        (larger value, higher up)

   so every amplitude, thickness and frequency axis in the set was labelled
   upside down over correctly drawn data. Three separate module panels showed a
   spectrum whose peak sat next to the label 0.2, a wedge whose truth line ran
   from "60 ms estimated at 0 ms true" upward, and a channel profile reading
   60 ms of fill at the margins where there is none.

   Nothing in the harnesses caught it, because they read the numbers in the
   stats strip and never look at the picture. So the check has to be arithmetic:
   draw a tick and plot a point for the SAME value, and require them to land on
   the same pixel row.
   =========================================================================== */

const fs = require('fs');
const vm = require('vm');

/* A canvas stub that records where text is drawn and where lines go. */
function stubCtx() {
  const calls = { text: [], moves: [], lines: [] };
  let tx = 0, ty = 0;
  const ctx = {
    canvas: { width: 800, height: 400 },
    save() {}, restore() {}, beginPath() {}, stroke() {}, fill() {},
    setLineDash() {}, clearRect() {}, fillRect() {}, closePath() {},
    translate(x, y) { tx += x; ty += y; }, rotate() {}, scale() {},
    measureText(s) { return { width: s.length * 6 }; },
    moveTo(x, y) { calls.moves.push([x + tx, y + ty]); },
    lineTo(x, y) { calls.lines.push([x + tx, y + ty]); },
    fillText(s, x, y) { calls.text.push({ s, x: x + tx, y: y + ty }); },
    drawImage() {}, createImageData: null, putImageData() {},
    arc() {}, quadraticCurveTo() {}, bezierCurveTo() {}, rect() {}, clip() {},
  };
  return { ctx, calls };
}
global.document = { createElement: () => ({ getContext: () => stubCtx().ctx, width: 0, height: 0 }) };
global.window = { devicePixelRatio: 1 };
global.getComputedStyle = () => ({ paddingLeft: '0', paddingRight: '0' });

vm.runInThisContext(fs.readFileSync('./assets/seismic.js', 'utf8') +
  '\nglobalThis.SEIS = SEIS;', { filename: 'assets/seismic.js' });

let pass = 0, fail = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= (tol == null ? 0.51 : tol);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(56)} ` +
    `label y ${got.toFixed(1).padStart(7)}   curve y ${want.toFixed(1).padStart(7)}`);
}

const rect = { x: 60, y: 20, w: 600, h: 300 };

/* Where a curve puts a value: the mapping used by every series()/plot helper
   in every module. If this line ever changes, the modules changed too. */
const curveY = (v, min, max) => rect.y + rect.h - ((v - min) / (max - min)) * rect.h;
/* And downward axes: time and depth, drawn first-sample-at-top. */
const curveYDown = (v, min, max) => rect.y + ((v - min) / (max - min)) * rect.h;

function labelY(min, max, value, opts) {
  const { ctx, calls } = stubCtx();
  SEIS.axisLeft(ctx, rect, min, max, null, (v) => v.toFixed(3), opts);
  const hit = calls.text.find((t) => Math.abs(parseFloat(t.s) - value) < 1e-6);
  if (!hit) throw new Error(`no tick drawn at ${value} for range ${min}..${max}`);
  return hit.y;
}

console.log('\n--- value axes: larger must sit higher -----------------------------');
const valueCases = [
  ['relative amplitude 0..1.1, at 0', 0, 1.1, 0],
  ['relative amplitude 0..1.1, at 1', 0, 1.1, 1],
  ['amplitude -1.05..1.05, at -1', -1.05, 1.05, -1],
  ['amplitude -1.05..1.05, at 1', -1.05, 1.05, 1],
  ['estimated thickness 0..60, at 0', 0, 60, 0],
  ['estimated thickness 0..60, at 40', 0, 60, 40],
  ['peak frequency 5..60, at 10', 5, 60, 10],
  ['peak frequency 5..60, at 50', 5, 60, 50],
  ['fill (ms) 0..62, at 0', 0, 62, 0],
  ['channel lit (%) 0..100, at 100', 0, 100, 100],
];
for (const [name, min, max, v] of valueCases) {
  check(name, labelY(min, max, v), curveY(v, min, max));
}

console.log('\n--- downward axes: time and map rows, first sample at the top ------');
const downCases = [
  ['time (ms) 0..400, at 0', 0, 400, 0],
  ['time (ms) 0..400, at 300', 0, 400, 300],
  ['inline 0..120, at 0', 0, 120, 0],
  ['inline 0..120, at 100', 0, 120, 100],
];
for (const [name, min, max, v] of downCases) {
  check(name, labelY(min, max, v, { down: true }), curveYDown(v, min, max));
}

console.log('\n--- the two directions must actually differ ------------------------');
{
  const up = labelY(0, 100, 100);
  const dn = labelY(0, 100, 100, { down: true });
  const ok = Math.abs(up - dn) > rect.h * 0.9;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${'{ down: true } inverts the axis'.padEnd(56)} ` +
    `up ${up.toFixed(1)}  down ${dn.toFixed(1)}`);
}
{
  // the retired option must be inert, not silently mean the opposite
  const plain = labelY(0, 100, 100);
  const legacy = labelY(0, 100, 100, { flip: true });
  const ok = Math.abs(plain - legacy) < 0.51;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${'legacy { flip: true } is a no-op'.padEnd(56)} ` +
    `plain ${plain.toFixed(1)}  flip ${legacy.toFixed(1)}`);
}

console.log('\n--- every axisLeft call in the modules is classified ---------------');
{
  const downLabels = /'((two-way )?time \(ms\)|inline|depth[^']*)'/;
  let unclassified = 0;
  for (const f of fs.readdirSync('modules').filter((x) => x.endsWith('.html'))) {
    const h = fs.readFileSync('modules/' + f, 'utf8');
    for (const m of h.matchAll(/axisLeft\(([\s\S]*?)\);/g)) {
      const call = m[1].replace(/\s+/g, ' ');
      const isDown = /down:\s*true/.test(call);
      const looksDown = downLabels.test(call);
      if (isDown !== looksDown) {
        unclassified++;
        console.log(`   FAIL ${f}: ${isDown ? 'marked down but is a value axis' :
          'a downward axis without { down: true }'} -> ${call.slice(0, 90)}`);
      }
    }
  }
  unclassified ? (fail += unclassified) : pass++;
  if (!unclassified) console.log('ok   every axis matches its label: time and inline down, values up');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
