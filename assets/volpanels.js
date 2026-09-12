/* =========================================================================
   volpanels.js — the panels the modules draw from the synthetic volume.

   volume.js makes the survey. This file draws it, so that adding a seismic
   display to a module is a few lines rather than a hundred, and so that every
   module draws one the same way.

   Two conventions are enforced here rather than left to each module:

     · A section carries two vertical axes. Two-way time down the left, depth
       in metres down the right, converted at the interval velocity in use.
       The two are not proportional, and a student who only ever sees
       milliseconds has no way to find that out.

     · A bed named in the prose is marked on the panel. markHorizon draws the
       surface with its name against it, so the coal is labelled on the
       picture instead of only in the paragraph beside it.

   Depends on assets/seismic.js for the drawing primitives and colormaps, and
   on assets/volume.js for the volume itself.
   ========================================================================= */
const VOLP = (function () {
  'use strict';

  if (typeof SEIS === 'undefined' || typeof VOL === 'undefined') {
    throw new Error('volpanels.js requires seismic.js and volume.js');
  }

  var TEAL = '#0B7285', CRIM = '#841617', SLATE = '#5C6670', INK = '#16191C';

  function pad(w, h) {
    return { x: 54, y: 14, w: w - 54 - 54, h: h - 14 - 34 };
  }

  /* --------------------------------------------------------------- section

     drawSection(ctx, rect, panel, opt)

     panel is what VOL.inline or VOL.crossline returns. opt.t0/opt.t1 set the
     time window in seconds; opt.velocity sets the metres axis on the right.  */

  function drawSection(ctx, rect, panel, opt) {
    var o = opt || {};
    var dt = panel.dt, t0 = panel.t0;
    var tA = o.tTop === undefined ? t0 : o.tTop;
    var tB = o.tBase === undefined ? t0 + (panel.nt - 1) * dt : o.tBase;
    var i0 = Math.max(0, Math.round((tA - t0) / dt));
    var i1 = Math.min(panel.nt - 1, Math.round((tB - t0) / dt));

    /* SEIS.drawSectionPanel takes one array per trace; the volume stores the
       survey as one flat buffer, so hand it views rather than a copy. */
    var traces = new Array(panel.n);
    for (var k = 0; k < panel.n; k++) {
      traces[k] = panel.data.subarray(k * panel.nt, (k + 1) * panel.nt);
    }

    var clip = o.clip || percentile(panel.data, 0.99);
    /* dt is deliberately not passed: drawSectionPanel would draw its own
       left-hand axis labelled "time (ms)", and the two-way time axis drawn
       below would then be written over the top of it. */
    SEIS.drawSectionPanel(ctx, traces, rect, {
      i0: i0, i1: i1, clip: clip,
      wiggle: o.wiggle === true,
      cmap: o.cmap || SEIS.COLORMAPS.gray,
      xlabel: o.xlabel || panel.axis || 'trace',
      xmin: 0, xmax: panel.n - 1
    });

    /* two-way time on the left */
    SEIS.axisLeft(ctx, rect, (t0 + i0 * dt) * 1000, (t0 + i1 * dt) * 1000,
      'two-way time (ms)', function (v) { return v.toFixed(0); },
      { ticks: 5, down: true });

    /* depth on the right, at the velocity in use */
    if (o.velocity) axisRightDepth(ctx, rect, t0 + i0 * dt, t0 + i1 * dt, o.velocity);

    return { i0: i0, i1: i1, clip: clip };
  }

  /* The second axis. Depth is velocity times one-way time, so the numbers on
     the right are not a rescaling of the numbers on the left unless the
     velocity is constant — which is the point of drawing both. */
  function axisRightDepth(ctx, rect, tA, tB, v) {
    var dA = tA * v / 2, dB = tB * v / 2;
    var ticks = SEIS.niceTicks(dA, dB, 5);
    ctx.save();
    ctx.strokeStyle = 'rgba(92,102,112,0.55)';
    ctx.fillStyle = SLATE;
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.w, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.stroke();
    for (var i = 0; i < ticks.length; i++) {
      var d = ticks[i];
      if (d < Math.min(dA, dB) || d > Math.max(dA, dB)) continue;
      var y = rect.y + ((d - dA) / (dB - dA)) * rect.h;
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.w, y);
      ctx.lineTo(rect.x + rect.w + 5, y);
      ctx.stroke();
      ctx.fillText(d.toFixed(0), rect.x + rect.w + 8, y);
    }
    ctx.save();
    ctx.translate(rect.x + rect.w + 46, rect.y + rect.h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('depth (m)', 0, 0);
    ctx.restore();
    ctx.restore();
  }

  /* Draw a named surface across a section, so a bed the prose names is marked
     on the picture. `pick` returns the time for trace index k. */
  /* opt.at   — fraction along the section at which to write the label, so that
                a top and a base can be named where they are furthest apart
                rather than at the last trace, where a pinch-out puts the two
                labels on top of one another.
     opt.dy   — vertical offset of the label from the horizon, in pixels.      */
  function markHorizon(ctx, rect, geom, dt, t0, pick, n, label, color, dash, opt) {
    var col = color || TEAL;
    var o = opt || {};
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    if (dash !== false) ctx.setLineDash([5, 4]);
    ctx.beginPath();
    var span = geom.i1 - geom.i0, drawn = false, lastY = 0, lastX = rect.x + 6;
    var kLab = o.at === undefined ? -1 : Math.round(o.at * (n - 1));
    var labY = null, labX = null;
    for (var k = 0; k < n; k++) {
      var t = pick(k);
      if (t === null || !isFinite(t)) continue;
      var y = rect.y + (((t - t0) / dt) - geom.i0) / span * rect.h;
      var x = rect.x + ((k + 0.5) / n) * rect.w;
      drawn ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      drawn = true; lastY = y; lastX = x;
      if (k === kLab) { labY = y; labX = x; }
    }
    ctx.stroke();
    ctx.restore();
    if (label) {
      var ly = (labY === null ? lastY : labY) + (o.dy === undefined ? -15 : o.dy);
      var lx = (labX === null ? rect.x + 6 : Math.min(labX, rect.x + rect.w - 60));
      SEIS.tag(ctx, o.at === undefined ? rect.x + 6 : lx, ly, label, col);
    }
  }

  /* ------------------------------------------------------------------- map

     drawMap(ctx, rect, values, nx, ny, opt) — a map in survey orientation,
     inline across and crossline up.                                          */

  function drawMap(ctx, rect, values, nx, ny, opt) {
    var o = opt || {};
    var clip = o.clip || percentile(values, 0.99);
    var lo = o.min === undefined ? (o.signed === false ? 0 : -clip) : o.min;
    var hi = o.max === undefined ? clip : o.max;
    var cmap = o.cmap || (o.signed === false ? SEIS.SEQMAPS.magma : SEIS.COLORMAPS.gray);
    var img = ctx.createImageData(nx, ny);
    for (var iy = 0; iy < ny; iy++) {
      for (var ix = 0; ix < nx; ix++) {
        var v = values[ix * ny + iy];
        var t = (v - lo) / (hi - lo || 1);
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var c = cmap(t);
        var p = ((ny - 1 - iy) * nx + ix) * 4;
        img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
      }
    }
    var tmp = document.createElement('canvas');
    tmp.width = nx; tmp.height = ny;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = o.smooth !== false;
    ctx.drawImage(tmp, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    SEIS.frame(ctx, rect);
    if (o.xlabel) SEIS.axisBottom(ctx, rect, 0, nx - 1, o.xlabel,
      function (v) { return v.toFixed(0); }, { ticks: 5 });
    return { lo: lo, hi: hi };
  }

  /* Outline the true extent of a feature on a map, from its truth thickness
     map, so what the display shows can be compared with what is there. */
  function outline(ctx, rect, truth, nx, ny, level, color) {
    var col = color || TEAL, cw = rect.w / nx, ch = rect.h / ny;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (var ix = 0; ix < nx - 1; ix++) {
      for (var iy = 0; iy < ny - 1; iy++) {
        var a = truth[ix * ny + iy] > level;
        var bx = truth[(ix + 1) * ny + iy] > level;
        var by = truth[ix * ny + iy + 1] > level;
        var X = rect.x + ix * cw, Y = rect.y + (ny - 1 - iy) * ch;
        if (a !== bx) { ctx.moveTo(X + cw, Y); ctx.lineTo(X + cw, Y + ch); }
        if (a !== by) { ctx.moveTo(X, Y); ctx.lineTo(X + cw, Y); }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function percentile(a, p) {
    var n = a.length, step = Math.max(1, Math.floor(n / 4000)), b = [];
    for (var i = 0; i < n; i += step) b.push(Math.abs(a[i]));
    b.sort(function (x, y) { return x - y; });
    return b[Math.floor(p * b.length)] || 1;
  }

  return {
    pad: pad, drawSection: drawSection, axisRightDepth: axisRightDepth,
    markHorizon: markHorizon, drawMap: drawMap, outline: outline,
    percentile: percentile,
    TEAL: TEAL, CRIM: CRIM, SLATE: SLATE, INK: INK
  };
})();
