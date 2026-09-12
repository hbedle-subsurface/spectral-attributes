/* ===========================================================================
   spectral.js — time-frequency math for "How Spectral Attributes Actually Work"
   Heather Bedle and April Moreno-Ward / AASPI / University of Oklahoma
   Vanilla JS, no dependencies, no build step.

   Companion to seismic.js, which supplies the wavelets, the FFT, the Hilbert
   transform, the colormaps and the drawing. This file supplies only what the
   spectral modules need on top of that: short-time Fourier, a continuous
   wavelet transform, matching pursuit, a sparse spectrum, the statistical
   measures, spectral balancing, blending, and a constant-Q filter.

   Conventions used throughout:
     - time in SECONDS, frequency in Hz, dt the sample interval in seconds
     - a "voice" is the real part of a complex spectral component, the same
       definition AASPI uses: v(t,f) = m(t,f) cos[phi(t,f)]
     - every transform is normalized so that a cosine of amplitude A at the
       analysis frequency returns magnitude A. This is a teaching choice: it
       makes the number on the screen mean something without a scale factor.
       AASPI does not normalize this way, so absolute magnitudes here are not
       comparable to AASPI output. Ratios and shapes are.
   =========================================================================== */

const SPEC = (function () {
  'use strict';

  /* Use seismic.js's FFT when it is loaded, and carry a local copy so a module
     still runs against a stale assets/ on the server. Same algorithm. */
  function localFFT(re, im, inverse) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (2 * Math.PI / len) * (inverse ? 1 : -1);
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const ar = re[i + k + len / 2], ai = im[i + k + len / 2];
          const vr = ar * cr - ai * ci, vi = ar * ci + ai * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  function fft(re, im, inverse) {
    if (typeof SEIS !== 'undefined' && SEIS.fft) return SEIS.fft(re, im, inverse);
    return localFFT(re, im, inverse);
  }

  function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }
  function wrapPi(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  /* =======================================================================
     THE MORLET FAMILY

     AASPI's spec_cwt builds its wavelet family from a mother Morlet centered
     at fc = 1.0 Hz inside a Gaussian window of variance sigma^2, scaled by
     s = 1/f to reach every other frequency. The whole family therefore has a
     constant ratio of center frequency to bandwidth — a constant-Q filter
     bank — which is the property that makes a CWT different from an STFT.

     DEPARTURE FROM THE DOCUMENTATION, stated because it matters if you check
     our numbers against theirs. spec_cwt's Figures 3-5 quote a quantity called
     the half-bandwidth fB/2 alongside a variance. For a Gaussian window the
     full half-power bandwidth of the mother wavelet works out to

         fB = sqrt(ln 2) / (pi * sigma) = 0.2651 / sigma      [Hz, at fc = 1]

     which reproduces their quoted numbers exactly — 0.265 at sigma^2 = 1.00,
     0.398 at sigma^2 = 0.44, 0.187 at sigma^2 = 2.00. So the number they call
     fB/2 is the FULL half-power bandwidth, not half of it. Their Figure 4 and
     Figure 5 captions also pair those bandwidths with the opposite variances,
     which would make a narrow-band wavelet short in time. We follow the
     arithmetic, not the captions: sigma is the primary parameter here and
     bandwidth is derived from it.
     ======================================================================= */

  const MORLET_K = Math.sqrt(Math.LN2) / Math.PI;   // 0.26507...

  // Full half-power bandwidth of the mother wavelet, in Hz, at fc = 1 Hz.
  function morletBandwidth(sigma) { return MORLET_K / sigma; }
  function morletSigma(bandwidth) { return MORLET_K / bandwidth; }

  // The mother wavelet in the time domain, for drawing it.
  // Returns { re, im } sampled on t.
  function morletWave(t, fc, sigma) {
    const env = Math.exp(-(t * t) / (2 * sigma * sigma));
    const a = 2 * Math.PI * fc * t;
    return { re: Math.cos(a) * env, im: Math.sin(a) * env };
  }

  /* Frequency response of the analytic Morlet filter tuned to fj.
     Unit peak gain on the positive frequencies, doubled so that the analytic
     output of a cosine has the amplitude of that cosine. */
  function morletResponse(f, fj, sigma) {
    if (f <= 0) return 0;
    const u = f / fj - 1;
    return 2 * Math.exp(-2 * Math.PI * Math.PI * sigma * sigma * u * u);
  }

  /* =======================================================================
     CONTINUOUS WAVELET TRANSFORM

     Implemented as a filter bank in the frequency domain, which is what the
     documentation says the CWT amounts to: "the spectrum of psi resembles a
     band-pass filter, [so] the CWT can also be interpreted as the application
     of a suite of filter banks to the original data."

     cwt(trace, dt, freqs, opts) -> {
       freqs, nt, sigma,
       re[j][i], im[j][i],       complex spectral component
       mag[j][i], phase[j][i],   magnitude and phase
       voice[j][i],              = re, i.e. m cos(phi)
       phaseCorr[j][i]           phase with the 2 pi f t traveltime removed
     }
     ======================================================================= */
  function cwt(trace, dt, freqs, opts) {
    opts = opts || {};
    const sigma = opts.sigma != null ? opts.sigma : 1.0;
    const t0 = opts.t0 != null ? opts.t0 : 0;
    const nt = trace.length;
    const n = nextPow2(2 * nt);

    const xr = new Float64Array(n), xi = new Float64Array(n);
    for (let i = 0; i < nt; i++) xr[i] = trace[i];
    fft(xr, xi, false);

    const df = 1 / (n * dt);
    const nf = freqs.length;
    const re = [], im = [], mag = [], phase = [], voice = [], phaseCorr = [];

    for (let j = 0; j < nf; j++) {
      const fj = freqs[j];
      const yr = new Float64Array(n), yi = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        const f = k <= n / 2 ? k * df : (k - n) * df;
        const h = morletResponse(f, fj, sigma);
        if (h === 0) continue;
        yr[k] = xr[k] * h;
        yi[k] = xi[k] * h;
      }
      fft(yr, yi, true);

      const R = new Float64Array(nt), I = new Float64Array(nt);
      const M = new Float64Array(nt), P = new Float64Array(nt);
      const V = new Float64Array(nt), C = new Float64Array(nt);
      for (let i = 0; i < nt; i++) {
        R[i] = yr[i]; I[i] = yi[i];
        M[i] = Math.hypot(yr[i], yi[i]);
        P[i] = Math.atan2(yi[i], yr[i]);
        V[i] = yr[i];
        C[i] = wrapPi(P[i] - 2 * Math.PI * fj * (t0 + i * dt));
      }
      re.push(R); im.push(I); mag.push(M); phase.push(P);
      voice.push(V); phaseCorr.push(C);
    }
    return { freqs: freqs.slice(), nt, dt, sigma, re, im, mag, phase, voice, phaseCorr };
  }

  /* Sum of the voices. The documentation states that the voices sum back to
     the trace; that is exactly true only when the filter bank sums to unity
     across the band. It does not, in general — see filterBankSum below, which
     is what the reconstruction module measures rather than assumes. */
  function voiceSum(tf) {
    const nt = tf.nt, nf = tf.freqs.length;
    const out = new Float64Array(nt);
    for (let j = 0; j < nf; j++) {
      const V = tf.voice[j];
      for (let i = 0; i < nt; i++) out[i] += V[i];
    }
    return out;
  }

  /* The combined response of the whole family, evaluated on a frequency axis.
     Flat means the voices reconstruct; a droop means they do not. */
  function filterBankSum(freqs, sigma, axis) {
    const out = new Float64Array(axis.length);
    for (let k = 0; k < axis.length; k++) {
      let s = 0;
      for (let j = 0; j < freqs.length; j++) s += morletResponse(axis[k], freqs[j], sigma);
      out[k] = s / 2;      // /2 undoes the analytic doubling
    }
    return out;
  }

  /* =======================================================================
     SHORT-TIME FOURIER TRANSFORM

     One window length for every frequency, which is the whole difference from
     the CWT above and the point of module 02. Brute-force DFT at the requested
     frequencies rather than an FFT, because the interpreter is free to sample
     the spectrum as finely as they like and the grids here are small.

     window: 'boxcar' | 'hann' | 'gauss'
     ======================================================================= */
  const WINDOWS = {
    boxcar: () => 1,
    hann: (u) => 0.5 * (1 - Math.cos(2 * Math.PI * u)),          // u in [0,1]
    gauss: (u) => Math.exp(-0.5 * Math.pow((u - 0.5) / 0.2, 2)),
  };

  function stft(trace, dt, freqs, opts) {
    opts = opts || {};
    const winLen = opts.winLen != null ? opts.winLen : 0.040;     // seconds
    const wname = opts.window || 'hann';
    const wfn = WINDOWS[wname] || WINDOWS.hann;
    const nt = trace.length;
    const half = Math.max(1, Math.round(winLen / dt / 2));
    const nw = 2 * half + 1;

    const w = new Float64Array(nw);
    let wsum = 0;
    for (let k = 0; k < nw; k++) { w[k] = wfn(k / (nw - 1)); wsum += w[k]; }
    const norm = wsum > 0 ? 2 / wsum : 0;

    const nf = freqs.length;
    const mag = [], phase = [], re = [], im = [];
    for (let j = 0; j < nf; j++) {
      mag.push(new Float64Array(nt));
      phase.push(new Float64Array(nt));
      re.push(new Float64Array(nt));
      im.push(new Float64Array(nt));
    }

    for (let i = 0; i < nt; i++) {
      for (let j = 0; j < nf; j++) {
        const f = freqs[j];
        let ar = 0, ai = 0;
        for (let k = 0; k < nw; k++) {
          const idx = i - half + k;
          if (idx < 0 || idx >= nt) continue;
          const tau = (k - half) * dt;
          const v = trace[idx] * w[k];
          const a = 2 * Math.PI * f * tau;
          ar += v * Math.cos(a);
          ai -= v * Math.sin(a);
        }
        ar *= norm; ai *= norm;
        re[j][i] = ar; im[j][i] = ai;
        mag[j][i] = Math.hypot(ar, ai);
        phase[j][i] = Math.atan2(ai, ar);
      }
    }
    return { freqs: freqs.slice(), nt, dt, winLen, window: wname, nw, re, im, mag, phase };
  }

  /* The frequency below which a window of this length cannot hold one cycle.
     The documentation quotes 25 Hz for a 40 ms window; this is that number. */
  function windowFloor(winLen) { return 1 / winLen; }

  /* =======================================================================
     MATCHING PURSUIT

     A greedy complex matching pursuit, in the shape Liu and Marfurt use in
     spec_cmp: find the envelope peaks of the residual analytic trace, take the
     instantaneous frequency at each peak as the atom frequency, fit a complex
     wavelet there, subtract, repeat. The complex spectrum of each fitted atom
     is accumulated to build the time-frequency distribution.

     DEPARTURE FROM PRODUCTION SOFTWARE: spec_cmp fits all the peaks above the
     beta threshold SIMULTANEOUSLY, by solving normal equations over a banded
     matrix. We fit them one at a time in descending envelope order within each
     iteration. On well-separated events the two agree; on a tuned doublet,
     where the top and bottom interfere, ours is biased in exactly the way the
     documentation warns a greedy algorithm is biased. That bias is visible in
     the module, deliberately.
     ======================================================================= */

  function analytic(trace) {
    const nt = trace.length;
    const n = nextPow2(2 * nt);
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < nt; i++) re[i] = trace[i];
    fft(re, im, false);
    for (let k = 1; k < n; k++) {
      if (k === n / 2) continue;
      if (k < n / 2) { re[k] *= 2; im[k] *= 2; } else { re[k] = 0; im[k] = 0; }
    }
    fft(re, im, true);
    return { re: re.slice(0, nt), im: im.slice(0, nt) };
  }

  function envelope(trace) {
    const a = analytic(trace);
    const out = new Float64Array(trace.length);
    for (let i = 0; i < out.length; i++) out[i] = Math.hypot(a.re[i], a.im[i]);
    return out;
  }

  // Instantaneous frequency in Hz, from the derivative of the analytic phase.
  function instFreq(trace, dt) {
    const a = analytic(trace);
    const nt = trace.length;
    const out = new Float64Array(nt);
    for (let i = 1; i < nt - 1; i++) {
      const p1 = Math.atan2(a.im[i + 1], a.re[i + 1]);
      const p0 = Math.atan2(a.im[i - 1], a.re[i - 1]);
      out[i] = wrapPi(p1 - p0) / (2 * 2 * Math.PI * dt);
    }
    out[0] = out[1]; out[nt - 1] = out[nt - 2];
    return out;
  }

  // Analytic Ricker atom of peak frequency f, centered at t = 0.
  function rickerAtom(t, f) {
    const a = Math.PI * Math.PI * f * f * t * t;
    const re = (1 - 2 * a) * Math.exp(-a);
    // Quadrature Ricker, in closed form: the Hilbert transform of the Ricker.
    // Computed numerically instead, to avoid a second special function.
    return re;
  }

  /* Instantaneous frequency at the envelope peak of a Ricker, divided by its
     peak frequency. The Ricker magnitude spectrum goes as f^2 exp(-f^2/fp^2),
     whose mean is 2 fp / sqrt(pi); for a symmetric wavelet the instantaneous
     frequency at the center equals that spectral mean. */
  const RICKER_INST_RATIO = 2 / Math.sqrt(Math.PI);      // 1.12838

  // Magnitude spectrum of a unit Ricker of peak frequency fp, at frequency f.
  function rickerSpectrum(f, fp) {
    const r = f / fp;
    return (2 / Math.sqrt(Math.PI)) * r * r * Math.exp(-r * r);
  }

  function matchingPursuit(trace, dt, opts) {
    opts = opts || {};
    const fmin = opts.fmin != null ? opts.fmin : 5;
    const fmax = opts.fmax != null ? opts.fmax : 100;
    const beta = opts.beta != null ? opts.beta : 0.5;      // fraction of peak envelope
    const maxIter = opts.maxIter != null ? opts.maxIter : 12;
    const rmsStop = opts.rmsStop != null ? opts.rmsStop : 0.02;
    const freqs = opts.freqs || null;
    const nt = trace.length;

    const resid = Float64Array.from(trace);
    const modeled = new Float64Array(nt);
    const atoms = [];

    const rms0 = Math.sqrt(resid.reduce((s, v) => s + v * v, 0) / nt) || 1;

    /* The threshold is a fraction of the envelope of the ORIGINAL trace, fixed
       for the whole run — not of the residual, which shrinks.

       Measured against the residual it behaves catastrophically on any trace
       with noise in it: the real events are removed in the first pass, the
       residual's own maximum collapses to the noise level, and from the second
       pass onward every ripple in the noise clears the threshold. A trace with
       five reflections in it came back fitted with seven hundred atoms and a
       residual of 0.1%, which is a perfect fit to the noise and a useless
       decomposition. */
    const env0 = envelope(resid);
    let emax0 = 0;
    for (let i = 0; i < nt; i++) if (env0[i] > emax0) emax0 = env0[i];
    if (emax0 <= 1e-12) return { atoms: [], modeled, residual: resid, tf: null };
    const thresh = beta * emax0;
    const maxPerIter = opts.maxPerIter != null ? opts.maxPerIter : 12;

    for (let it = 0; it < maxIter; it++) {
      const env = envelope(resid);
      const inst = instFreq(resid, dt);

      // local maxima above the fixed threshold, strongest first
      let peaks = [];
      for (let i = 1; i < nt - 1; i++) {
        if (env[i] >= env[i - 1] && env[i] > env[i + 1] && env[i] >= thresh) {
          peaks.push(i);
        }
      }
      if (!peaks.length) break;
      peaks.sort((a, b) => env[b] - env[a]);
      if (peaks.length > maxPerIter) peaks = peaks.slice(0, maxPerIter);

      let fitted = 0;
      for (const k of peaks) {
        let f = inst[k];
        if (!isFinite(f)) continue;
        /* The documentation says to take the atom frequency from the
           instantaneous frequency at the envelope peak. For a Ricker those are
           not the same number: the mean of a Ricker's magnitude spectrum, and
           therefore its instantaneous frequency at the peak, is 2/sqrt(pi)
           times its peak frequency — about 13% high. Left uncorrected, every
           atom is fitted with a wavelet that is too short and the residual
           never converges properly. */
        f = f / RICKER_INST_RATIO;
        f = Math.min(fmax, Math.max(fmin, f));

        // build the atom and its quadrature over its own support
        const hw = Math.min(nt - 1, Math.ceil(1.6 / (f * dt)));
        const len = 2 * hw + 1;
        const w = new Float64Array(len);
        for (let m = -hw; m <= hw; m++) w[m + hw] = rickerAtom(m * dt, f);
        const wq = hilbertOf(w);

        // least-squares complex amplitude against the residual
        let nr = 0, ni = 0, den = 0;
        for (let m = -hw; m <= hw; m++) {
          const idx = k + m;
          if (idx < 0 || idx >= nt) continue;
          const d = resid[idx];
          nr += d * w[m + hw];
          ni += d * wq[m + hw];
          den += w[m + hw] * w[m + hw];
        }
        if (den <= 1e-14) continue;
        const ar = nr / den, ai = ni / den;
        const amp = Math.hypot(ar, ai);
        if (amp < 1e-10) continue;
        const ph = Math.atan2(ai, ar);

        // subtract the phase-rotated atom
        for (let m = -hw; m <= hw; m++) {
          const idx = k + m;
          if (idx < 0 || idx >= nt) continue;
          const v = ar * w[m + hw] + ai * wq[m + hw];
          resid[idx] -= v;
          modeled[idx] += v;
        }
        atoms.push({ t: k * dt, i: k, f, amp, phase: ph });
        fitted++;
      }
      if (!fitted) break;

      const rms = Math.sqrt(resid.reduce((s, v) => s + v * v, 0) / nt);
      if (rms / rms0 < rmsStop) break;
    }

    // accumulate the complex spectrum of the atoms onto a t-f grid
    let tf = null;
    if (freqs) {
      const nf = freqs.length;
      const mag = [], re = [], im = [];
      for (let j = 0; j < nf; j++) {
        mag.push(new Float64Array(nt));
        re.push(new Float64Array(nt));
        im.push(new Float64Array(nt));
      }
      /* Each atom's spectrum is spread over the atom's own duration rather than
         dropped on the single sample at its center. An atom is a wavelet, not an
         impulse: putting all of its energy on one sample makes the panel a row
         of isolated dots, and any readout taken at a time that is not exactly an
         atom center comes back as zero. The spread is a Gaussian of standard
         deviation half a period, which is about the envelope of the Ricker the
         atom is made of. */
      for (const a of atoms) {
        const sig = 0.5 / Math.max(a.f, 1e-6);
        const half = Math.min(nt, Math.ceil(3 * sig / dt));
        for (let d = -half; d <= half; d++) {
          const i2 = a.i + d;
          if (i2 < 0 || i2 >= nt) continue;
          const t = d * dt;
          const w = Math.exp(-(t * t) / (2 * sig * sig));
          if (w < 1e-4) continue;
          for (let j = 0; j < nf; j++) {
            const sp = a.amp * rickerSpectrum(freqs[j], a.f) * w;
            if (sp < 1e-14) continue;
            re[j][i2] += sp * Math.cos(a.phase);
            im[j][i2] += sp * Math.sin(a.phase);
          }
        }
      }
      for (let j = 0; j < nf; j++) {
        for (let i = 0; i < nt; i++) mag[j][i] = Math.hypot(re[j][i], im[j][i]);
      }
      tf = { freqs: freqs.slice(), nt, dt, re, im, mag };
    }

    return { atoms, modeled, residual: resid, tf };
  }

  // Hilbert transform of a short array, used for the quadrature atom.
  function hilbertOf(x) {
    const n0 = x.length;
    const n = nextPow2(2 * n0);
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n0; i++) re[i] = x[i];
    fft(re, im, false);
    for (let k = 1; k < n; k++) {
      if (k === n / 2) continue;
      if (k < n / 2) { re[k] *= 2; im[k] *= 2; } else { re[k] = 0; im[k] = 0; }
    }
    fft(re, im, true);
    const out = new Float64Array(n0);
    for (let i = 0; i < n0; i++) out[i] = im[i];
    return out;
  }

  /* =======================================================================
     SPARSE SPECTRUM

     The stand-in for spec_max_entropy. Same forward problem as a DFT of a
     windowed segment, but solved as an underdetermined inverse with an
     iteratively reweighted model norm, which is what lets it resolve two
     frequencies closer together than 1/T. Portniaguine and Castagna's point,
     and the one place in the set where the uncertainty trade is beaten rather
     than obeyed.

     Solved in the dual form m = Q F^H (F Q F^H + alpha I)^-1 d, so the matrix
     inverted is n x n in the number of SAMPLES, not the number of frequencies.
     ======================================================================= */
  function sparseSpectrum(seg, dt, freqs, opts) {
    opts = opts || {};
    const iters = opts.iters != null ? opts.iters : 6;
    const alpha = opts.alpha != null ? opts.alpha : 0.01;
    const n = seg.length, m = freqs.length;

    /* Real cosine/sine basis, two unknowns per frequency. A complex
       exponential basis fitted to a real data vector would force the model's
       imaginary part to zero, which is a constraint nobody intended and which
       pulls the peaks off their true frequencies. */
    const t = new Float64Array(n);
    for (let i = 0; i < n; i++) t[i] = (i - (n - 1) / 2) * dt;

    let q = new Float64Array(m).fill(1);          // one weight per frequency
    let ca = new Float64Array(m), sa = new Float64Array(m);

    for (let it = 0; it < iters; it++) {
      /* G = F Q F^T + lambda I, and because cos a cos b + sin a sin b
         collapses to cos(a-b), the whole n x n matrix is a sum of cosines of
         the sample separation. */
      const G = [];
      for (let a = 0; a < n; a++) G.push(new Float64Array(n));
      for (let a = 0; a < n; a++) {
        for (let b = a; b < n; b++) {
          const dtau = t[a] - t[b];
          let s = 0;
          for (let j = 0; j < m; j++) s += q[j] * Math.cos(2 * Math.PI * freqs[j] * dtau);
          G[a][b] = s; G[b][a] = s;
        }
      }
      let tr = 0;
      for (let a = 0; a < n; a++) tr += G[a][a];
      const lam = alpha * (tr / n);
      for (let a = 0; a < n; a++) G[a][a] += lam;

      const y = solveSymmetric(G, seg);
      if (!y) break;

      ca = new Float64Array(m); sa = new Float64Array(m);
      for (let j = 0; j < m; j++) {
        let c = 0, s = 0;
        for (let i = 0; i < n; i++) {
          const a = 2 * Math.PI * freqs[j] * t[i];
          c += Math.cos(a) * y[i];
          s += Math.sin(a) * y[i];
        }
        ca[j] = q[j] * c; sa[j] = q[j] * s;
      }

      // reweight: favor the strong components, attenuate their aliases
      let mmax = 0;
      for (let j = 0; j < m; j++) mmax = Math.max(mmax, Math.hypot(ca[j], sa[j]));
      if (mmax <= 1e-14) break;
      const eps = 1e-3 * mmax;
      q = new Float64Array(m);
      for (let j = 0; j < m; j++) {
        const a = Math.hypot(ca[j], sa[j]) + eps;
        q[j] = (a * a) / (mmax * mmax);
      }
    }

    const mag = new Float64Array(m), phase = new Float64Array(m);
    for (let j = 0; j < m; j++) {
      mag[j] = Math.hypot(ca[j], sa[j]);
      phase[j] = Math.atan2(-sa[j], ca[j]);
    }
    return { freqs: freqs.slice(), mag, phase, cos: ca, sin: sa };
  }

  // Real symmetric solve by Gaussian elimination with partial pivoting.
  function solveSymmetric(A, b) {
    const n = b.length;
    const M = [];
    for (let i = 0; i < n; i++) M.push(Float64Array.from(A[i]));
    const x = Float64Array.from(b);
    for (let k = 0; k < n; k++) {
      let piv = k, best = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(M[i][k]) > best) { best = Math.abs(M[i][k]); piv = i; }
      }
      if (best < 1e-14) return null;
      if (piv !== k) {
        const t2 = M[k]; M[k] = M[piv]; M[piv] = t2;
        const s2 = x[k]; x[k] = x[piv]; x[piv] = s2;
      }
      for (let i = k + 1; i < n; i++) {
        const f = M[i][k] / M[k][k];
        if (f === 0) continue;
        for (let j = k; j < n; j++) M[i][j] -= f * M[k][j];
        x[i] -= f * x[k];
      }
    }
    for (let k = n - 1; k >= 0; k--) {
      let s = x[k];
      for (let j = k + 1; j < n; j++) s -= M[k][j] * x[j];
      x[k] = s / M[k][k];
    }
    return x;
  }

  /* =======================================================================
     STATISTICAL MEASURES OF THE SPECTRUM

     Following the definitions in spec_cwt and spec_cmp. Both definitions of
     bandwidth are returned, because the two AASPI programs do not agree:
     spec_cwt uses the half-magnitude points, spec_cmp and spec_max_entropy use
     the difference between percentiles of the spectrum. On a balanced spectrum
     they give different numbers, which is a fact worth showing rather than
     hiding behind one choice.
     ======================================================================= */
  function specStats(mag, freqs, opts) {
    opts = opts || {};
    const pct = opts.pct != null ? opts.pct : 0.15;
    const n = mag.length;
    let jpk = 0;
    for (let j = 1; j < n; j++) if (mag[j] > mag[jpk]) jpk = j;

    // parabolic interpolation through the three samples around the mode
    let peakFreq = freqs[jpk], peakMag = mag[jpk];
    if (jpk > 0 && jpk < n - 1) {
      const y0 = mag[jpk - 1], y1 = mag[jpk], y2 = mag[jpk + 1];
      const den = y0 - 2 * y1 + y2;
      if (Math.abs(den) > 1e-14) {
        const d = 0.5 * (y0 - y2) / den;                 // in samples
        const df = freqs[jpk + 1] - freqs[jpk];
        peakFreq = freqs[jpk] + d * df;
        peakMag = y1 - 0.25 * (y0 - y2) * d;
      }
    }

    let sum = 0, fsum = 0;
    for (let j = 0; j < n; j++) { sum += mag[j]; fsum += mag[j] * freqs[j]; }
    const meanMag = sum / n;
    const meanFreq = sum > 0 ? fsum / sum : 0;

    // half-magnitude bandwidth (spec_cwt)
    const halfLevel = peakMag / 2;
    let lo = freqs[0], hi = freqs[n - 1];
    for (let j = jpk; j > 0; j--) if (mag[j] < halfLevel) { lo = freqs[j]; break; }
    for (let j = jpk; j < n - 1; j++) if (mag[j] < halfLevel) { hi = freqs[j]; break; }
    const bandwidthHalfMag = hi - lo;

    // percentile bandwidth and range-trimmed mean (spec_cmp)
    const cum = new Float64Array(n);
    let run = 0;
    for (let j = 0; j < n; j++) { run += mag[j]; cum[j] = run; }
    const total = run || 1;
    let jlo = 0, jhi = n - 1;
    for (let j = 0; j < n; j++) if (cum[j] / total >= pct) { jlo = j; break; }
    for (let j = n - 1; j >= 0; j--) if (cum[j] / total <= 1 - pct) { jhi = j; break; }
    if (jhi < jlo) jhi = jlo;
    const bandwidthPct = freqs[jhi] - freqs[jlo];
    let rsum = 0, rn = 0;
    for (let j = jlo; j <= jhi; j++) { rsum += mag[j]; rn++; }
    const rtmMag = rn ? rsum / rn : 0;
    const peakMagAboveMean = peakMag - rtmMag;

    // log-log slope and roughness over the trimmed range
    let sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0;
    for (let j = jlo; j <= jhi; j++) {
      if (freqs[j] <= 0 || mag[j] <= 0) continue;
      const x = Math.log(freqs[j]), y = Math.log(mag[j]);
      sx += x; sy += y; sxx += x * x; sxy += x * y; cnt++;
    }
    let slope = 0, roughness = 0;
    if (cnt >= 2) {
      const den = cnt * sxx - sx * sx;
      if (Math.abs(den) > 1e-14) {
        slope = (cnt * sxy - sx * sy) / den;
        const c = (sy - slope * sx) / cnt;
        let err = 0, tot = 0;
        const ybar = sy / cnt;
        for (let j = jlo; j <= jhi; j++) {
          if (freqs[j] <= 0 || mag[j] <= 0) continue;
          const y = Math.log(mag[j]);
          const yh = slope * Math.log(freqs[j]) + c;
          err += (y - yh) * (y - yh);
          tot += (y - ybar) * (y - ybar);
        }
        roughness = tot > 1e-14 ? Math.min(1, err / tot) : 0;
      }
    }

    // moments, treating the spectrum as a distribution over frequency
    let m2 = 0, m3 = 0, m4 = 0;
    for (let j = 0; j < n; j++) {
      const d = freqs[j] - meanFreq;
      m2 += mag[j] * d * d; m3 += mag[j] * d * d * d; m4 += mag[j] * d * d * d * d;
    }
    m2 /= total; m3 /= total; m4 /= total;
    const sd = Math.sqrt(m2);
    const skewness = sd > 1e-12 ? m3 / (sd * sd * sd) : 0;
    const kurtosis = sd > 1e-12 ? m4 / (m2 * m2) : 0;
    const effKurtosis = kurtosis - 3;

    return {
      peakFreq, peakMag, meanFreq, meanMag, rtmMag, peakMagAboveMean,
      bandwidthHalfMag, bandwidthPct, slope, roughness,
      skewness, kurtosis, effKurtosis,
      tuningThickness: peakFreq > 0 ? 1 / (2 * peakFreq) : Infinity,
    };
  }

  /* =======================================================================
     SPECTRAL BALANCING AND BLUING

     The survey-average operator described in spec_cwt and spec_cmp: average
     the power over traces and a vertical window, take the peak of that average
     at each time, and scale each spectrum by the peak over the average plus a
     prewhitening fraction alpha of the peak. Bluing then tilts the result by
     f^beta.

     The documentation gives alpha as 0.01 in one program and 0.02 in another,
     with the GUI text recommending 1% and calling 4% conservative. We default
     to 0.01 and expose it, because the value is the parameter the module is
     about.
     ======================================================================= */
  function balanceOperator(avgMag, freqs, opts) {
    opts = opts || {};
    const alpha = opts.alpha != null ? opts.alpha : 0.01;
    const beta = opts.beta != null ? opts.beta : 0.0;
    const n = avgMag.length;
    const pow = new Float64Array(n);
    let pk = 0;
    for (let j = 0; j < n; j++) { pow[j] = avgMag[j] * avgMag[j]; if (pow[j] > pk) pk = pow[j]; }
    const scale = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      const s = Math.sqrt(pk) / (Math.sqrt(pow[j]) + alpha * Math.sqrt(pk));
      const blue = beta ? Math.pow(Math.max(freqs[j], 1e-6) / Math.max(freqs[n - 1], 1e-6), beta) : 1;
      scale[j] = s * blue;
    }
    return scale;
  }

  function applyBalance(mag, scale) {
    const out = new Float64Array(mag.length);
    for (let j = 0; j < mag.length; j++) out[j] = mag[j] * scale[j];
    return out;
  }

  /* Average magnitude spectrum over a set of traces, which is what makes the
     operator stable. Trace-by-trace balancing is available for the module that
     shows why the documentation warns against it. */
  function averageSpectrum(traces, dt, freqs, opts) {
    const acc = new Float64Array(freqs.length);
    for (const tr of traces) {
      const tf = cwt(tr, dt, freqs, opts);
      for (let j = 0; j < freqs.length; j++) {
        let s = 0;
        for (let i = 0; i < tf.nt; i++) s += tf.mag[j][i];
        acc[j] += s / tf.nt;
      }
    }
    for (let j = 0; j < freqs.length; j++) acc[j] /= traces.length;
    return acc;
  }

  /* =======================================================================
     BLENDING

     rgbBlend takes three magnitude arrays and three clip ranges and returns
     packed [r,g,b] bytes. hueLightness is AASPI's hlplot scheme: one attribute
     drives hue, another drives lightness, which is how peak frequency is
     normally displayed — and is why a peak frequency map goes dark where the
     peak magnitude is near zero, exactly where the frequency means nothing.
     ======================================================================= */
  function clip01(v, lo, hi) {
    if (hi <= lo) return 0;
    const u = (v - lo) / (hi - lo);
    return u < 0 ? 0 : u > 1 ? 1 : u;
  }

  function rgbBlend(r, g, b, ranges) {
    const n = r.length;
    const out = new Uint8ClampedArray(n * 3);
    for (let i = 0; i < n; i++) {
      out[i * 3] = 255 * clip01(r[i], ranges.r[0], ranges.r[1]);
      out[i * 3 + 1] = 255 * clip01(g[i], ranges.g[0], ranges.g[1]);
      out[i * 3 + 2] = 255 * clip01(b[i], ranges.b[0], ranges.b[1]);
    }
    return out;
  }

  /* =======================================================================
     OVERLAY COMPOSITING — what a co-rendered blend actually is

     rgbBlend() above writes three maps straight into three display channels.
     That is the ADDITIVE model: the three contributions add, order is
     irrelevant, and a pixel bright in all three comes out white.

     An OVERLAY is a different operation and gives a different picture. Each
     map is a layer with its own color and its own opacity, and the layers are
     composited one over the next:

         out = out * (1 - a) + color * a,     a = opacity * value

     The magnitude drives the opacity, so a layer is transparent where its
     frequency has nothing and opaque where it is strong. Two consequences
     that the additive model does not have, and that the module is built to
     show: a layer HIDES what is underneath it wherever it is opaque, and
     ORDER MATTERS — swap the top and bottom layers and the picture changes.

     Both conventions are in use, which is a large part of why two people can
     load the same three volumes in two packages and disagree about what the
     map shows.

     layers: [{ value, color: [r,g,b], opacity, on }] composited first to last,
     over `bg`. `value` is already normalized to 0..1 by the caller, because
     how it was normalized is itself a decision the module makes visible.
     ======================================================================= */
  function overlayPixel(layers, bg) {
    let r = bg[0], g = bg[1], b = bg[2];
    for (let k = 0; k < layers.length; k++) {
      const L = layers[k];
      if (L.on === false) continue;
      const a = Math.max(0, Math.min(1, (L.opacity == null ? 1 : L.opacity) * L.value));
      if (a <= 0) continue;
      r = r * (1 - a) + L.color[0] * a;
      g = g * (1 - a) + L.color[1] * a;
      b = b * (1 - a) + L.color[2] * a;
    }
    return [r, g, b];
  }

  /* The same thing over a whole map. values is an array of arrays, one per
     layer, each already 0..1; returns a Uint8ClampedArray of r,g,b triples. */
  function overlayBlend(values, opts) {
    const o = opts || {};
    const colors = o.colors || [[229, 57, 53], [67, 160, 71], [30, 136, 229]];
    const opacity = o.opacity || [1, 1, 1];
    const on = o.on || [true, true, true];
    const order = o.order || values.map((_, k) => k);
    const bg = o.bg || [16, 19, 21];
    const n = values[0].length;
    const out = new Uint8ClampedArray(n * 3);
    const layers = order.map((k) => ({ color: colors[k], opacity: opacity[k], on: on[k], value: 0 }));
    for (let i = 0; i < n; i++) {
      order.forEach((k, j) => { layers[j].value = values[k][i]; });
      const c = overlayPixel(layers, bg);
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
    return out;
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = (h % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    const m = l - c / 2;
    return [255 * (r + m), 255 * (g + m), 255 * (b + m)];
  }

  function hueLightness(hueVal, lightVal, opts) {
    opts = opts || {};
    const hr = opts.hueRange || [0, 1];
    const lr = opts.lightRange || [0, 1];
    const h0 = opts.hue0 != null ? opts.hue0 : 300;      // magenta
    const h1 = opts.hue1 != null ? opts.hue1 : 0;        // through red
    const sat = opts.sat != null ? opts.sat : 0.75;
    const n = hueVal.length;
    const out = new Uint8ClampedArray(n * 3);
    for (let i = 0; i < n; i++) {
      const u = clip01(hueVal[i], hr[0], hr[1]);
      const l = 0.15 + 0.70 * clip01(lightVal[i], lr[0], lr[1]);
      const rgb = hslToRgb(h0 + (h1 - h0) * u, sat, l);
      out[i * 3] = rgb[0]; out[i * 3 + 1] = rgb[1]; out[i * 3 + 2] = rgb[2];
    }
    return out;
  }

  /* =======================================================================
     CONSTANT-Q ATTENUATION

     Forward-only, for module 09: propagate a trace through t seconds of a
     medium with quality factor Q. Amplitude loss exp(-pi f t / Q), with the
     velocity dispersion that must accompany it. There is no Q ESTIMATION here
     and none in the AASPI documentation supplied — the module teaches what
     attenuation does to a spectrum, not how to invert for it.

     THE DISPERSION SIGN, because it is easy to get backwards. In Kjartansson's
     constant-Q medium the phase velocity RISES with frequency, so the travel
     time falls:

         t(f) = t_ref * (f / f_ref)^(-1/(pi Q))

     High frequencies therefore arrive EARLIER than the reference, not later.
     Written as a phase correction on top of a delay already equal to t_ref,
     with the exp(-i 2 pi f t) forward convention this file's FFT uses:

         phi(f) = -2 pi f [ t(f) - t_ref ]

     An earlier version of this function carried that term with the opposite
     sign, which put the high frequencies late. Nothing in the amplitude
     spectrum notices, so no readout in module 09 changed when it was fixed —
     only the shape of the propagated wavelet, which was mirrored in time.
     verify-spectral.js now measures the group delay at three frequencies so
     the sign cannot quietly flip back.
     ======================================================================= */
  function applyQ(trace, dt, Q, travelTime, opts) {
    opts = opts || {};
    const fref = opts.fref != null ? opts.fref : 50;
    const dispersion = opts.dispersion !== false;
    const nt = trace.length;
    const n = nextPow2(2 * nt);
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < nt; i++) re[i] = trace[i];
    fft(re, im, false);
    const df = 1 / (n * dt);
    for (let k = 0; k < n; k++) {
      const f = k <= n / 2 ? k * df : (k - n) * df;
      const af = Math.abs(f);
      if (af < 1e-9) continue;
      const amp = Math.exp(-Math.PI * af * travelTime / Q);
      let ph = 0;
      if (dispersion) {
        // exact power law, rather than its small-argument logarithmic expansion
        const teff = travelTime * Math.pow(af / fref, -1 / (Math.PI * Q));
        ph = -2 * Math.PI * f * (teff - travelTime);
      }
      const c = Math.cos(ph), s = Math.sin(ph);
      const a = re[k], b = im[k];
      re[k] = amp * (a * c - b * s);
      im[k] = amp * (a * s + b * c);
    }
    fft(re, im, true);
    const out = new Float64Array(nt);
    for (let i = 0; i < nt; i++) out[i] = re[i];
    return out;
  }

  /* =======================================================================
     TUNING WEDGE

     A wedge section built from a reflectivity doublet, for module 04. Returns
     the section, the true thickness of every trace, and the amplitude and
     apparent thickness read off it, so the tuning curve is measured from the
     picture rather than drawn from theory.
     ======================================================================= */
  function wedge(opts) {
    opts = opts || {};
    const nx = opts.nx != null ? opts.nx : 60;
    const dt = opts.dt != null ? opts.dt : 0.001;
    const nt = opts.nt != null ? opts.nt : 400;
    const t0 = opts.t0 != null ? opts.t0 : 0.10;
    const maxThick = opts.maxThick != null ? opts.maxThick : 0.040;   // seconds
    const rTop = opts.rTop != null ? opts.rTop : 0.1;
    const rBot = opts.rBot != null ? opts.rBot : -0.1;
    const wav = opts.wavelet;                     // a seismic.js wavelet object

    const traces = [], thickness = new Float64Array(nx);
    for (let ix = 0; ix < nx; ix++) {
      const T = (ix / (nx - 1)) * maxThick;
      thickness[ix] = T;
      const tr = new Float64Array(nt);
      for (let i = 0; i < nt; i++) {
        const t = i * dt;
        tr[i] = rTop * wav.fn(t - t0) + rBot * wav.fn(t - (t0 + T));
      }
      traces.push(tr);
    }
    return { traces, thickness, dt, nt, t0, nx };
  }

  /* Notch frequencies of a doublet of separation T: the spectrum of
     [+r at 0, -r at T] goes as 2|sin(pi f T)|, so it peaks at 1/(2T) and
     notches at n/T. This is the closed form the tuning module is checked
     against. */
  function doubletSpectrum(f, T) { return Math.abs(2 * Math.sin(Math.PI * f * T)); }
  function tuningFrequency(T) { return 1 / (2 * T); }
  function tuningThickness(fpeak) { return 1 / (2 * fpeak); }

  /* --------------------------------------------------------------------- */

  return {
    // Morlet family
    MORLET_K, morletBandwidth, morletSigma, morletWave, morletResponse,
    // transforms
    cwt, voiceSum, filterBankSum, stft, WINDOWS, windowFloor,
    matchingPursuit, sparseSpectrum, rickerSpectrum, RICKER_INST_RATIO,
    // helpers
    analytic, envelope, instFreq, wrapPi,
    // attributes
    specStats,
    // balancing
    balanceOperator, applyBalance, averageSpectrum,
    // display
    rgbBlend, overlayBlend, overlayPixel, hueLightness, hslToRgb,
    // physics
    applyQ, wedge, doubletSpectrum, tuningFrequency, tuningThickness,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SPEC;
