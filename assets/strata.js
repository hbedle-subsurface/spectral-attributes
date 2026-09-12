/* =========================================================================
   strata.js — a layered geological cross-section for the spectral modules.

   Ported from two of the companion sets rather than invented here, so that a
   student who has worked through those meets the same rocks and the same
   section in this one:

     · ROCKS is the lithology table from the seismic resolution set,
       modules/model1d.html (PRESETS). Velocities in m/s, densities in g/cc.
       Those numbers are the ones that set was built and checked against.

     · buildSection follows the layer construction in the seismic resolution
       set, modules/faults.html (buildLayers): reflection coefficient signs
       alternate most of the time rather than at random, because a pure coin
       flip lets impedance wander in one direction and the result reads as a
       gradient instead of as beds.

   What is new here is the target bed: one named bed inside the package whose
   thickness varies across the section, so that a single display shows the same
   bed above tuning, at tuning and below it, inside stratigraphy rather than as
   an isolated wedge. That is what the spectral modules need and what neither
   companion set provides.

   Depends on assets/seismic.js for the wavelet and the RNG.
   ========================================================================= */
const STRATA = (function () {
  'use strict';

  /* Lithologies, from the seismic resolution set's model1d module.
     v: interval velocity, m/s.  d: bulk density, g/cc. */
  var ROCKS = {
    shale:     { name: 'Shale',      v: 2500, d: 2.40 },
    shaleDeep: { name: 'Shale',      v: 2600, d: 2.45 },
    sand:      { name: 'Sand',       v: 2750, d: 2.30 },
    wetSand:   { name: 'Wet sand',   v: 2540, d: 2.38 },
    gasSand:   { name: 'Gas sand',   v: 1950, d: 2.02 },
    limestone: { name: 'Limestone',  v: 4900, d: 2.62 },
    coal:      { name: 'Coal',       v: 2200, d: 1.35 },
    sandstone: { name: 'Sandstone',  v: 2900, d: 2.35 }
  };

  /* Named targets a student can select. Each is the bed that thins across the
     section, together with the rock it sits in. The impedance contrast is what
     makes them behave differently, and it is worth a student seeing that a coal
     is a very strong reflector and a wet sand a very weak one. */
  var TARGETS = {
    sandInShale: { target: 'sand',      host: 'shale',     label: 'Sand in shale' },
    gasInShale:  { target: 'gasSand',   host: 'shale',     label: 'Gas sand in shale' },
    wetInShale:  { target: 'wetSand',   host: 'shale',     label: 'Wet sand in shale' },
    coalInSand:  { target: 'coal',      host: 'sandstone', label: 'Coal in sandstone' },
    limeInShale: { target: 'limestone', host: 'shaleDeep', label: 'Limestone in shale' }
  };

  function impedance(rock) { return rock.v * rock.d; }

  /* Reflection coefficient at a boundary, upper rock over lower rock. */
  function rc(upper, lower) {
    var a = impedance(upper), b = impedance(lower);
    return (b - a) / (b + a);
  }

  /* -----------------------------------------------------------------------
     buildSection(opt) -> { traces, nx, nt, dt, t0, thickness, targetTop,
                            rcTop, rcBase, layers, label }

     opt.nx        traces across the section            (default 120)
     opt.nt        samples per trace                    (default 600)
     opt.dt        sample interval, seconds             (default 0.0005)
     opt.f         Ricker peak frequency, Hz            (default 30)
     opt.target    key into TARGETS                     (default sandInShale)
     opt.thickL    target thickness at the left edge, ms   (default 60)
     opt.thickR    target thickness at the right edge, ms  (default 0)
     opt.tTarget   two-way time of the target top, s    (default 0.150)
     opt.strata    background beds above and below      (default true)
     opt.noise     noise as a percent of the strongest reflection (default 0)
     opt.seed      RNG seed, so a section is reproducible (default 20260906)

     thickness[ix] is the true target thickness in seconds at each trace, which
     is what any measurement made from the section has to be checked against.
     ----------------------------------------------------------------------- */
  function buildSection(opt) {
    var o = opt || {};
    var nx = o.nx || 120, nt = o.nt || 600, dt = o.dt || 0.0005;
    var f = o.f || 30;
    var tTarget = o.tTarget === undefined ? 0.150 : o.tTarget;
    var thickL = (o.thickL === undefined ? 60 : o.thickL) / 1000;
    var thickR = (o.thickR === undefined ? 0 : o.thickR) / 1000;
    var spec = TARGETS[o.target || 'sandInShale'];
    var host = ROCKS[spec.host], tgt = ROCKS[spec.target];
    var rcTop = rc(host, tgt), rcBase = rc(tgt, host);

    var wav = SEIS.makeWavelet({ type: 'ricker', f: f });
    var rnd = SEIS.mulberry32((o.seed || 20260906) >>> 0);

    /* Background stratigraphy: beds above and below the target, with signs
       that mostly alternate. Built once and shared by every trace, so the
       background is flat and any lateral change on the section comes from the
       target bed alone. */
    var bg = [];
    if (o.strata !== false) {
      var sign = -1, t = 0.030;
      while (t < tTarget - 0.030) {
        bg.push({ t: t, r: sign * (0.030 + rnd() * 0.045) });
        sign = rnd() < 0.82 ? -sign : sign;
        t += 0.018 + rnd() * 0.030;
      }
      var tb = tTarget + Math.max(thickL, thickR) + 0.035;
      sign = 1;
      while (tb < (nt - 40) * dt) {
        bg.push({ t: tb, r: sign * (0.030 + rnd() * 0.045) });
        sign = rnd() < 0.82 ? -sign : sign;
        tb += 0.018 + rnd() * 0.030;
      }
    }

    var traces = [], thickness = new Float64Array(nx);
    var strongest = Math.max(Math.abs(rcTop), Math.abs(rcBase));
    for (var ix = 0; ix < nx; ix++) {
      var u = nx > 1 ? ix / (nx - 1) : 0;
      var T = thickL + (thickR - thickL) * u;
      thickness[ix] = T;
      var tr = new Float64Array(nt);
      for (var i = 0; i < nt; i++) {
        var tt = i * dt, v = 0;
        for (var k = 0; k < bg.length; k++) v += bg[k].r * wav.fn(tt - bg[k].t);
        v += rcTop * wav.fn(tt - tTarget);
        v += rcBase * wav.fn(tt - (tTarget + T));
        tr[i] = v;
      }
      traces.push(tr);
    }

    if (o.noise > 0) {
      var amp = (o.noise / 100) * strongest;
      for (var jx = 0; jx < nx; jx++) {
        var raw = new Float64Array(nt), sm = new Float64Array(nt), rms = 0;
        for (var m = 0; m < nt; m++) raw[m] = rnd() * 2 - 1;
        for (var n = 1; n < nt - 1; n++) sm[n] = (raw[n - 1] + raw[n] + raw[n + 1]) / 3;
        for (var p = 0; p < nt; p++) rms += sm[p] * sm[p];
        rms = Math.sqrt(rms / nt) || 1;
        for (var q = 0; q < nt; q++) traces[jx][q] += (amp / rms) * sm[q];
      }
    }

    return {
      traces: traces, nx: nx, nt: nt, dt: dt, t0: 0,
      thickness: thickness, targetTop: tTarget,
      rcTop: rcTop, rcBase: rcBase, layers: bg,
      label: spec.label, targetName: tgt.name, hostName: host.name
    };
  }

  /* Mark the true top and base of the target bed on a drawn section, so a
     student can see where the bed actually is against what the seismic shows.
     rect and the i0/i1 sample range must match the drawSectionPanel call. */
  function markTarget(ctx, sec, rect, i0, i1, color) {
    var n = i1 - i0;
    ctx.save();
    ctx.strokeStyle = color || '#0B7285';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    for (var pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (var ix = 0; ix < sec.nx; ix++) {
        var t = sec.targetTop + (pass ? sec.thickness[ix] : 0);
        var y = rect.y + ((t / sec.dt) - i0) / n * rect.h;
        var x = rect.x + ((ix + 0.5) / sec.nx) * rect.w;
        ix === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    ROCKS: ROCKS, TARGETS: TARGETS,
    impedance: impedance, rc: rc,
    buildSection: buildSection, markTarget: markTarget
  };
})();
