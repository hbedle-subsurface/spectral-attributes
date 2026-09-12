/* =========================================================================
   volume.js — a synthetic 3D seismic volume, built from a geological model.

   The other assets in this directory make one trace or one section. This one
   makes a survey: nx inlines by ny crosslines by nt samples, generated from a
   seed at load time rather than stored, so nothing here is a picture and the
   model can be pushed until it breaks.

   What it is for. Every measurement a module makes on this volume can be
   checked against a truth map, which is the thing no real survey provides.
   build() returns both the amplitudes and the maps they came from: channel
   fill thickness, sheet sand thickness, gas column, the time of every named
   horizon, and the attenuation each trace carries.

   The model. A clastic shelf section with, from the top down:

     · a regional marker limestone, strong, used as the reference horizon
       for flattening;
     · a reservoir sand over a four-way anticline, gas-filled above a flat
       contact and wet below it, so the volume carries a bright spot and a
       flat spot and casts an attenuation shadow beneath;
     · a channel system incised into shale, in two stages, the younger one
       eroding through the older where they cross;
     · a sheet sand thinning to a pinchout, which is a tuning wedge in map
       view as well as in section;
     · a coal, thin and very strong;
     · a normal fault offsetting everything below the marker.

   Rocks. The lithology table is the one from the seismic resolution set, by
   way of strata.js, so a student meets the same velocities and densities as
   in the companion sets. One rock is added here: porousSand. The resolution
   set's Sand is a tight sand whose impedance is within half a per cent of
   shale, giving a reflection coefficient of -0.0035 — weaker than the
   background bedding, and genuinely invisible. That is a true and useful
   fact, and it is available through the channelRock option, but a channel
   filled with it teaches nothing about spectral decomposition, so the
   default fill is a porous brine sand.

   Every reflection coefficient in the volume is computed from impedance
   rather than chosen, including the background bedding, which is a set of
   small impedance perturbations of the host shale.

   Attenuation. One mechanism handles two effects. Each reflection carries
   t*, the integral of dt/Q down its own two-way path, so the section loses
   high frequencies with depth on every trace and loses them faster beneath
   the gas column. The wavelet is therefore nonstationary: a bank of wavelets
   is built across the range of t* present and interpolated per reflection.

   Depends on assets/seismic.js for the wavelet, the RNG and the FFT. Uses
   STRATA.ROCKS when strata.js is loaded and carries an identical copy when
   it is not, so this file can be dropped into the other repositories alone.
   ========================================================================= */
const VOL = (function () {
  'use strict';

  if (typeof SEIS === 'undefined') {
    throw new Error('volume.js requires assets/seismic.js to be loaded first');
  }

  /* v: interval velocity, m/s.  d: bulk density, g/cc. */
  var BASE_ROCKS = {
    shale:     { name: 'Shale',      v: 2500, d: 2.40 },
    shaleDeep: { name: 'Shale',      v: 2600, d: 2.45 },
    sand:      { name: 'Sand',       v: 2750, d: 2.30 },
    wetSand:   { name: 'Wet sand',   v: 2540, d: 2.38 },
    gasSand:   { name: 'Gas sand',   v: 1950, d: 2.02 },
    limestone: { name: 'Limestone',  v: 4900, d: 2.62 },
    coal:      { name: 'Coal',       v: 2200, d: 1.35 },
    sandstone: { name: 'Sandstone',  v: 2900, d: 2.35 }
  };
  var ROCKS = {};
  var SRC = (typeof STRATA !== 'undefined' && STRATA.ROCKS) ? STRATA.ROCKS : BASE_ROCKS;
  for (var rk in SRC) ROCKS[rk] = SRC[rk];
  /* added here, not in the resolution set: a porous brine-filled channel sand */
  ROCKS.porousSand = { name: 'Porous sand', v: 2350, d: 2.20 };

  function impedance(rock) { return rock.v * rock.d; }
  function rcOf(a, b) { var x = impedance(a), y = impedance(b); return (y - x) / (y + x); }

  /* Quality factor by rock name. Not part of the resolution set's table,
     because that set has no attenuation in it. Gas sand is given a low Q
     because that is the effect module 09 needs; the size of it in real rock
     is argued over and these numbers are illustrative. */
  var Q_OF = {
    'Shale': 110, 'Sand': 130, 'Porous sand': 90, 'Wet sand': 120,
    'Gas sand': 18, 'Limestone': 200, 'Coal': 40, 'Sandstone': 140
  };
  function qOf(rock) { return Q_OF[rock.name] || 110; }

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function smooth01(x) { return x <= 0 ? 0 : (x >= 1 ? 1 : x * x * (3 - 2 * x)); }

  /* ------------------------------------------------------- the wavelet bank

     A constant-Q operator applied to the source wavelet at a set of t* values
     spanning what the model contains. Amplitude is multiplied by
     exp(-pi f t*). Dispersion adds the Kjartansson phase term
     2 f t* ln(f/fref), which makes the high frequencies arrive slightly
     early. It is small at these Q and is here for correctness.               */

  function buildBank(wav, tstarMax, opt) {
    var dtw = opt.dtw || 0.0005;
    var half = Math.max(wav.halfLength * (1 + 6 * tstarMax * wav.fdom), 0.06);
    var n = 1; while (n < Math.ceil(2 * half / dtw)) n *= 2;
    var K = opt.bankSize || 16;
    var fref = opt.fref || 50;
    var bank = { dtw: dtw, n: n, half: (n / 2) * dtw, K: K, tstarMax: tstarMax, w: [] };

    for (var k = 0; k < K; k++) {
      var ts = tstarMax * (K === 1 ? 0 : k / (K - 1));
      var re = new Float64Array(n), im = new Float64Array(n);
      for (var i = 0; i < n; i++) re[i] = wav.fn((i < n / 2 ? i : i - n) * dtw);
      SEIS.fft(re, im, false);
      for (var j = 0; j < n; j++) {
        var kk = j < n / 2 ? j : j - n;
        var f = Math.abs(kk) / (n * dtw);
        var amp = Math.exp(-Math.PI * f * ts);
        var ph = (opt.dispersion && ts > 0 && f > 0.5)
          ? 2 * f * ts * Math.log(f / fref) * (kk < 0 ? -1 : 1) : 0;
        var c = Math.cos(ph), s = Math.sin(ph);
        var a = re[j] * amp, b = im[j] * amp;
        re[j] = a * c - b * s;
        im[j] = a * s + b * c;
      }
      SEIS.fft(re, im, true);
      var w = new Float32Array(n);
      for (var m = 0; m < n; m++) w[m] = re[(m + n / 2) % n];
      bank.w.push(w);
    }
    return bank;
  }

  /* ------------------------------------------------------------ the model */

  var DEFAULTS = {
    nx: 96, ny: 96, nt: 360,
    dt: 0.004, t0: 0.400,
    dx: 25, dy: 25,                 // bin size, metres
    f: 30,                          // source peak frequency, Hz
    wavelet: 'ricker',
    noise: 0,                       // per cent of the strongest reflection
    seed: 20260907,

    background: true,               // the bedding the targets sit in
    structure: true,
    fault: true,
    channels: true,
    secondChannel: true,
    wedge: true,
    gas: true,
    attenuation: true,
    dispersion: true,

    channelRock: 'porousSand',      // 'sand' gives the invisible-channel case
    wedgeRock: 'porousSand',

    tMarker: 0.600,
    tRes: 0.780,
    tChannel: 0.950,                // top of the channel fill; it incises downward
    tWedge: 1.200,
    tCoal: 1.420,

    channelFill: 34,                // thalweg fill, ms
    channelWidth: 13,               // half width, in bins
    thinDownstream: 0.45,
    wedgeMax: 45,                   // sheet sand at the thick end, ms
    gasColumn: 45,                  // gas column at the crest, ms
    gwcTime: null,                  // set the contact directly, for thin volumes
    reservoirThk: 60,               // reservoir unit, ms; must exceed gasColumn
    crest: 0.070,                   // structural relief at the crest, s
    dip: 0.020,                     // regional dip across the survey, s
    faultThrow: 0.022,
    bedStrength: 0.130              // largest bedding impedance perturbation
  };

  function structureAt(o, u, v) {
    if (!o.structure) return 0;
    var reg = o.dip * (v - 0.5);
    var du = (u - 0.42) / 0.20, dv = (v - 0.38) / 0.24;
    return reg - o.crest * Math.exp(-(du * du + dv * dv));
  }

  function faultAt(o, u, v) {
    if (!o.fault) return 0;
    if (u <= 0.58 + 0.10 * (v - 0.5)) return 0;
    return o.faultThrow * smooth01((v - 0.08) / 0.18) * smooth01((0.94 - v) / 0.18);
  }

  function channelAt(o, u, v, stage) {
    var p = stage === 2
      ? { amp: 0.10, k: 1.4, phase: 2.1, c: 0.58, w: 0.62, fill: 0.60 }
      : { amp: 0.16, k: 1.0, phase: 0.0, c: 0.46, w: 1.00, fill: 1.00 };
    var axis = p.c + p.amp * Math.sin(2 * Math.PI * p.k * v + p.phase);
    var halfW = (o.channelWidth * p.w) / o.nx;
    var d = Math.abs(u - axis) / halfW;
    if (d >= 1) return 0;
    var shape = 0.5 + 0.5 * Math.cos(Math.PI * d);
    return (o.channelFill / 1000) * p.fill * shape * Math.max(0, 1 - o.thinDownstream * v);
  }

  /* --------------------------------------------------------------- build() */

  function build(opt) {
    var o = {}, key;
    for (key in DEFAULTS) o[key] = DEFAULTS[key];
    for (key in (opt || {})) o[key] = opt[key];

    var nx = o.nx, ny = o.ny, nt = o.nt, dt = o.dt, t0 = o.t0;
    var ntr = nx * ny, tEnd = t0 + (nt - 1) * dt;

    var wav = o.wavelet === 'ormsby'
      ? SEIS.makeWavelet({ type: 'ormsby', f1: o.f1 || 8, f2: o.f2 || 14, f3: o.f3 || 48, f4: o.f4 || 60 })
      : SEIS.makeWavelet({ type: 'ricker', f: o.f });
    var rnd = SEIS.mulberry32(o.seed >>> 0);

    var IpShale = impedance(ROCKS.shale), IpShaleD = impedance(ROCKS.shaleDeep);
    var chanRock = ROCKS[o.channelRock] || ROCKS.porousSand;
    var wedgeRock = ROCKS[o.wedgeRock] || ROCKS.porousSand;

    /* Q looked up by impedance, built once rather than per reflection. */
    var qKeys = [], qVals = [];
    for (var rr in ROCKS) { qKeys.push(impedance(ROCKS[rr])); qVals.push(qOf(ROCKS[rr])); }
    function qForIp(Ip) {
      for (var i = 0; i < qKeys.length; i++) if (Math.abs(qKeys[i] - Ip) < 1) return qVals[i];
      return Q_OF['Shale'];
    }

    /* Background bedding: laterally continuous thin beds, each a small
       impedance perturbation of the host shale, signs mostly alternating so
       the section reads as beds rather than as a gradient. */
    var beds = [];
    if (o.background) {
      var sign = -1, tb = t0 + 0.020;
      while (tb < tEnd - 0.030) {
        var thk = 0.008 + rnd() * 0.014;
        beds.push({ t: tb, thk: thk, dIp: sign * (0.045 + rnd() * (o.bedStrength - 0.045)) });
        sign = rnd() < 0.82 ? -sign : sign;
        tb += thk + 0.014 + rnd() * 0.032;
      }
    }

    /* The gas-water contact is flat in time, which is what makes it a flat
       spot. It is placed from the shallowest top-reservoir anywhere in the
       survey, so the largest column is exactly gasColumn and the gas sits in
       the four-way closure rather than wherever the section happens to rise. */
    var Smin = 1e9;
    for (var au = 0; au < nx; au++) {
      for (var av = 0; av < ny; av++) {
        var S0 = structureAt(o, nx > 1 ? au / (nx - 1) : 0, ny > 1 ? av / (ny - 1) : 0);
        if (S0 < Smin) Smin = S0;
      }
    }
    var tGWC = (o.gwcTime !== undefined && o.gwcTime !== null)
      ? o.gwcTime : o.tRes + Smin + o.gasColumn / 1000;

    /* --------------------------------------------------- column machinery */
    var CAP = beds.length * 2 + 48;
    var ct = new Float64Array(CAP), cIp = new Float64Array(CAP), cn = 0;

    function colReset(t, Ip) { ct[0] = t; cIp[0] = Ip; cn = 1; }
    function ipAt(t) {
      var Ip = cIp[0];
      for (var i = 0; i < cn; i++) { if (ct[i] <= t) Ip = cIp[i]; else break; }
      return Ip;
    }
    function insertPoint(t, Ip) {
      var i = cn;
      while (i > 0 && ct[i - 1] > t) { ct[i] = ct[i - 1]; cIp[i] = cIp[i - 1]; i--; }
      ct[i] = t; cIp[i] = Ip; cn++;
    }
    function colSet(tTop, tBase, Ip) {
      if (!(tBase > tTop)) return;
      var below = ipAt(tBase), w = 0;
      for (var i = 0; i < cn; i++) {
        if (ct[i] >= tTop && ct[i] <= tBase) continue;
        ct[w] = ct[i]; cIp[w] = cIp[i]; w++;
      }
      cn = w;
      insertPoint(tTop, Ip);
      insertPoint(tBase, below);
    }

    /* truth maps */
    var chan1 = new Float32Array(ntr), chan2 = new Float32Array(ntr);
    var wedgeT = new Float32Array(ntr), gasT = new Float32Array(ntr);
    var tsRes = new Float32Array(ntr), tsDeep = new Float32Array(ntr);
    var hMarker = new Float32Array(ntr), hRes = new Float32Array(ntr);
    var hGWC = new Float32Array(ntr), hChan = new Float32Array(ntr);
    var hWedge = new Float32Array(ntr), hCoal = new Float32Array(ntr);

    var data = new Float32Array(ntr * nt);
    var strongest = 0, tstarMax = 0;
    var tstar0 = o.attenuation ? t0 / 110 : 0;   // the section above the volume

    var spT = new Float64Array(CAP), spR = new Float64Array(CAP), spS = new Float64Array(CAP);
    var allT = new Array(ntr), allR = new Array(ntr), allS = new Array(ntr);

    for (var ix = 0; ix < nx; ix++) {
      var u = nx > 1 ? ix / (nx - 1) : 0;
      for (var iy = 0; iy < ny; iy++) {
        var v = ny > 1 ? iy / (ny - 1) : 0;
        var ic = ix * ny + iy;
        var S = structureAt(o, u, v);

        colReset(t0 - 0.100, IpShale);
        insertPoint(o.tChannel + S, IpShaleD);

        for (var b = 0; b < beds.length; b++) {
          var bt = beds[b].t + S;
          colSet(bt, bt + beds[b].thk,
            (bt < o.tChannel + S ? IpShale : IpShaleD) * (1 + beds[b].dIp));
        }

        var tm = o.tMarker + S; hMarker[ic] = tm;
        colSet(tm, tm + 0.014, impedance(ROCKS.limestone));

        var tr = o.tRes + S; hRes[ic] = tr;
        var resBase = tr + o.reservoirThk / 1000, column = 0;
        if (o.gas) {
          column = clamp(tGWC - tr, 0, Math.min(o.gasColumn / 1000, o.reservoirThk / 1000));
          gasT[ic] = column;
          if (column > 0) colSet(tr, tr + column, impedance(ROCKS.gasSand));
        }
        hGWC[ic] = tr + column;
        colSet(tr + column, resBase, impedance(ROCKS.wetSand));

        var tc = o.tChannel + S; hChan[ic] = tc;   // the top of the fill
        if (o.channels) {
          var T1 = channelAt(o, u, v, 1);
          var T2 = o.secondChannel ? channelAt(o, u, v, 2) : 0;
          if (T2 > 0) T1 = Math.max(0, T1 - T2 * 1.6);
          chan1[ic] = T1; chan2[ic] = T2;
          /* An incised channel has a flat top and a curved base: erosion cuts
             down from the datum, the fill accumulates, and the whole thing is
             buried by a roughly conformable surface. So the fill runs from tc
             downward, and horizons.channel is the top of the fill. Building it
             the other way up makes a mound, which is a different landform. */
          if (T1 > 0) colSet(tc, tc + T1, impedance(chanRock));
          if (T2 > 0) colSet(tc, tc + T2, impedance(chanRock));
        }

        var tw = o.tWedge + S; hWedge[ic] = tw;
        if (o.wedge) {
          var Tw = (o.wedgeMax / 1000) * clamp(1.12 - 1.25 * u, 0, 1);
          wedgeT[ic] = Tw;
          if (Tw > 0.0005) colSet(tw, tw + Tw, impedance(wedgeRock));
        }

        var tcoal = o.tCoal + S; hCoal[ic] = tcoal;
        colSet(tcoal, tcoal + 0.006, impedance(ROCKS.coal));

        /* reflection coefficients, then the fault shift */
        var ns = 0, thr = faultAt(o, u, v), faultLevel = o.tMarker + S - 0.010;
        for (var q = 1; q < cn; q++) {
          var a1 = cIp[q - 1], b1 = cIp[q];
          if (a1 === b1) continue;
          var st = ct[q];
          if (thr > 0 && st > faultLevel) st += thr;
          spT[ns] = st; spR[ns] = (b1 - a1) / (b1 + a1); ns++;
        }
        if (thr > 0) {
          hRes[ic] += thr; hGWC[ic] += thr; hChan[ic] += thr;
          hWedge[ic] += thr; hCoal[ic] += thr;
          if (tm > faultLevel) hMarker[ic] += thr;
        }

        /* t* down each reflection's own two-way path */
        if (o.attenuation) {
          var acc = tstar0, tPrev = t0;
          for (var z = 0; z < ns; z++) {
            acc += (spT[z] - tPrev) / qForIp(ipAt((tPrev + spT[z]) / 2));
            spS[z] = acc; tPrev = spT[z];
            if (spT[z] <= hRes[ic]) tsRes[ic] = acc;
            if (spT[z] <= hCoal[ic]) tsDeep[ic] = acc;
          }
          if (acc > tstarMax) tstarMax = acc;
        }

        var tA = new Float64Array(ns), rA = new Float64Array(ns), sA = new Float64Array(ns);
        for (var y = 0; y < ns; y++) {
          tA[y] = spT[y]; rA[y] = spR[y]; sA[y] = o.attenuation ? spS[y] : 0;
          if (Math.abs(spR[y]) > strongest) strongest = Math.abs(spR[y]);
        }
        allT[ic] = tA; allR[ic] = rA; allS[ic] = sA;
      }
    }

    /* Convolution, with each reflection taking the wavelet its own t* implies */
    var bank = buildBank(wav, o.attenuation ? tstarMax : 0, {
      dispersion: !!(o.dispersion && o.attenuation),
      bankSize: o.bankSize, fref: o.fref
    });
    var gScale = bank.tstarMax > 0 ? (bank.K - 1) / bank.tstarMax : 0;
    var invDtw = 1 / bank.dtw, halfN = bank.n / 2;

    for (var ic2 = 0; ic2 < ntr; ic2++) {
      var T = allT[ic2], Rr = allR[ic2], Ss = allS[ic2], base = ic2 * nt;
      for (var k2 = 0; k2 < T.length; k2++) {
        var st2 = T[k2], sr = Rr[k2];
        var g = clamp(Ss[k2] * gScale, 0, bank.K - 1);
        var k0 = Math.floor(g), k1 = k0 + 1 < bank.K ? k0 + 1 : k0, fk = g - k0;
        var w0 = bank.w[k0], w1 = bank.w[k1], mk = 1 - fk;
        var i0 = Math.ceil((st2 - bank.half - t0) / dt); if (i0 < 0) i0 = 0;
        var i1 = Math.floor((st2 + bank.half - t0) / dt); if (i1 > nt - 1) i1 = nt - 1;
        var p = ((t0 + i0 * dt) - st2) * invDtw + halfN, dp = dt * invDtw;
        for (var i2 = i0; i2 <= i1; i2++, p += dp) {
          var j0 = p | 0, fp = p - j0;
          if (j0 < 0 || j0 + 1 >= bank.n) continue;
          var v0 = w0[j0] + (w0[j0 + 1] - w0[j0]) * fp;
          var v1 = w1[j0] + (w1[j0 + 1] - w1[j0]) * fp;
          data[base + i2] += sr * (v0 * mk + v1 * fk);
        }
      }
    }

    if (o.noise > 0) addNoise(data, nx * ny, nt, dt, wav, (o.noise / 100) * strongest, o.seed + 7);

    return {
      nx: nx, ny: ny, nt: nt, dt: dt, t0: t0, dx: o.dx, dy: o.dy,
      data: data, wav: wav, opt: o, rocks: ROCKS,
      tstarMax: tstarMax, strongestRC: strongest, tGWC: tGWC,
      horizons: {
        marker: hMarker, reservoir: hRes, gwc: hGWC,
        channel: hChan, wedge: hWedge, coal: hCoal
      },
      truth: {
        channel1: chan1, channel2: chan2, channel: maxMap(chan1, chan2),
        wedge: wedgeT, gas: gasT, tstarRes: tsRes, tstarDeep: tsDeep
      },
      rc: {
        gasTop: rcOf(ROCKS.shale, ROCKS.gasSand),
        flatSpot: rcOf(ROCKS.gasSand, ROCKS.wetSand),
        channel: rcOf(ROCKS.shaleDeep, chanRock),
        tightSandInShale: rcOf(ROCKS.shaleDeep, ROCKS.sand),
        coalInShale: rcOf(ROCKS.shaleDeep, ROCKS.coal),
        limestone: rcOf(ROCKS.shale, ROCKS.limestone)
      }
    };
  }

  /* One build serving every panel on a page. Building is the expensive part
     and slicing is not, so a module should call shared() with the parameters
     its header sliders set, and slice the result as often as it likes. The
     cache holds the last few builds, keyed on the options. */
  var CACHE = [];
  function shared(opt) {
    var key = JSON.stringify(opt || {});
    for (var i = 0; i < CACHE.length; i++) {
      if (CACHE[i].key === key) {
        var hit = CACHE.splice(i, 1)[0];
        CACHE.unshift(hit);
        return hit.vol;
      }
    }
    var vol = build(opt);
    CACHE.unshift({ key: key, vol: vol });
    while (CACHE.length > 4) CACHE.pop();
    return vol;
  }

  function maxMap(a, b) {
    var out = new Float32Array(a.length);
    for (var i = 0; i < a.length; i++) out[i] = a[i] > b[i] ? a[i] : b[i];
    return out;
  }

  function addNoise(data, ntr, nt, dt, wav, amp, seed) {
    var rnd = SEIS.mulberry32(seed >>> 0);
    var hw = Math.ceil(wav.halfLength / dt);
    var w = new Float32Array(2 * hw + 1), sum2 = 0;
    for (var i = 0; i <= 2 * hw; i++) { w[i] = wav.fn((i - hw) * dt); sum2 += w[i] * w[i]; }
    var norm = Math.sqrt(sum2) || 1;
    var white = new Float32Array(nt + 2 * hw);
    for (var ic = 0; ic < ntr; ic++) {
      for (var j = 0; j < white.length; j++) white[j] = SEIS.gaussRand(rnd);
      var base = ic * nt;
      for (var k = 0; k < nt; k++) {
        var acc = 0;
        for (var m = -hw; m <= hw; m++) acc += w[m + hw] * white[k + m + hw];
        data[base + k] += amp * acc / norm;
      }
    }
  }

  /* ------------------------------------------------------------- accessors */

  function base(vol, ix, iy) { return (ix * vol.ny + iy) * vol.nt; }
  function trace(vol, ix, iy) { var b = base(vol, ix, iy); return vol.data.subarray(b, b + vol.nt); }

  function inline(vol, ix) {
    var out = new Float32Array(vol.ny * vol.nt);
    out.set(vol.data.subarray(ix * vol.ny * vol.nt, (ix + 1) * vol.ny * vol.nt));
    return { data: out, n: vol.ny, nt: vol.nt, dt: vol.dt, t0: vol.t0, axis: 'crossline' };
  }
  function crossline(vol, iy) {
    var out = new Float32Array(vol.nx * vol.nt);
    for (var ix = 0; ix < vol.nx; ix++) {
      out.set(vol.data.subarray(base(vol, ix, iy), base(vol, ix, iy) + vol.nt), ix * vol.nt);
    }
    return { data: out, n: vol.nx, nt: vol.nt, dt: vol.dt, t0: vol.t0, axis: 'inline' };
  }

  function sampleAt(vol, ic, t) {
    var p = (t - vol.t0) / vol.dt, j = Math.floor(p), f = p - j, b = ic * vol.nt;
    var a = (j >= 0 && j < vol.nt) ? vol.data[b + j] : 0;
    var c = (j + 1 >= 0 && j + 1 < vol.nt) ? vol.data[b + j + 1] : 0;
    return a * (1 - f) + c * f;
  }

  /* Constant two-way time, which cuts across structure. */
  function timeSlice(vol, t) {
    var out = new Float32Array(vol.nx * vol.ny);
    for (var ic = 0; ic < out.length; ic++) out[ic] = sampleAt(vol, ic, t);
    return out;
  }

  /* Amplitude on a picked surface. mode 'value' takes the sample; 'peak' and
     'rms' take a window of the given length centred on it. */
  function horizonSlice(vol, horizon, offset, mode, window) {
    var off = offset || 0, m = mode || 'value';
    var hw = Math.max(0, Math.round(((window || 0) / 2) / vol.dt));
    var out = new Float32Array(vol.nx * vol.ny);
    for (var ic = 0; ic < out.length; ic++) {
      var t = horizon[ic] + off;
      if (m === 'value') { out[ic] = sampleAt(vol, ic, t); continue; }
      var i0 = Math.round((t - vol.t0) / vol.dt), b = ic * vol.nt;
      var acc = 0, n = 0, pk = 0;
      for (var k = i0 - hw; k <= i0 + hw; k++) {
        if (k < 0 || k >= vol.nt) continue;
        var vv = vol.data[b + k];
        acc += vv * vv; n++;
        if (Math.abs(vv) > Math.abs(pk)) pk = vv;
      }
      out[ic] = m === 'peak' ? pk : Math.sqrt(acc / (n || 1));
    }
    return out;
  }

  /* Every trace shifted so a horizon lies flat. The step every real spectral
     workflow starts with, and the one a flat model hides. */
  function flatten(vol, horizon, tRef) {
    var ref = tRef === undefined ? mean(horizon) : tRef;
    var out = new Float32Array(vol.nx * vol.ny * vol.nt);
    for (var ic = 0; ic < vol.nx * vol.ny; ic++) {
      var shift = (horizon[ic] - ref) / vol.dt, b = ic * vol.nt;
      for (var i = 0; i < vol.nt; i++) {
        var p = i + shift, j = Math.floor(p), f = p - j;
        var a = (j >= 0 && j < vol.nt) ? vol.data[b + j] : 0;
        var c = (j + 1 >= 0 && j + 1 < vol.nt) ? vol.data[b + j + 1] : 0;
        out[b + i] = a * (1 - f) + c * f;
      }
    }
    var v2 = {}; for (var k in vol) v2[k] = vol[k];
    v2.data = out; v2.flattenedOn = ref;
    return v2;
  }

  /* n surfaces spaced proportionally between two horizons: constant relative
     geological age rather than constant time. */
  function stratalSlab(vol, top, bot, n) {
    var slices = [];
    for (var k = 0; k < n; k++) {
      var frac = n === 1 ? 0.5 : k / (n - 1);
      var surf = new Float32Array(top.length);
      for (var ic = 0; ic < top.length; ic++) surf[ic] = top[ic] + frac * (bot[ic] - top[ic]);
      slices.push({ frac: frac, surface: surf, amp: horizonSlice(vol, surf, 0, 'value') });
    }
    return slices;
  }

  /* The windowed sub-volume a decomposition is actually run on. */
  function windowOn(vol, horizon, offset, length) {
    var nw = Math.round(length / vol.dt);
    var out = new Float32Array(vol.nx * vol.ny * nw);
    for (var ic = 0; ic < vol.nx * vol.ny; ic++) {
      var start = horizon[ic] + (offset || 0);
      for (var i = 0; i < nw; i++) out[ic * nw + i] = sampleAt(vol, ic, start + i * vol.dt);
    }
    return { data: out, nx: vol.nx, ny: vol.ny, nt: nw, dt: vol.dt, t0: 0 };
  }

  /* ------------------------------------------------------ time into metres

     The conversion uses the velocity of the bed, not a survey average, which
     is the difference between 16.7 ms being 23 m of porous sand and 41 m of
     limestone.                                                               */
  function thicknessInMetres(ms, rockKey) {
    return (ms / 1000) * (ROCKS[rockKey] || ROCKS.shale).v / 2;
  }
  function tuningThickness(f, rockKey) {
    var ms = 1000 / (2 * f);
    return { ms: ms, m: thicknessInMetres(ms, rockKey) };
  }

  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function rms(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }
  function bytes(vol) { return vol.data.byteLength; }

  return {
    ROCKS: ROCKS, Q_OF: Q_OF, DEFAULTS: DEFAULTS,
    impedance: impedance, rcOf: rcOf, qOf: qOf,
    build: build, shared: shared,
    trace: trace, inline: inline, crossline: crossline, sampleAt: sampleAt,
    timeSlice: timeSlice, horizonSlice: horizonSlice,
    flatten: flatten, stratalSlab: stratalSlab, windowOn: windowOn,
    thicknessInMetres: thicknessInMetres, tuningThickness: tuningThickness,
    mean: mean, rms: rms, bytes: bytes
  };
})();
