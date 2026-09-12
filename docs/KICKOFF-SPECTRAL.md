# Kickoff: *How Spectral Attributes Actually Work*

Read this first, then `STYLE_BRIEF.md`. This file covers what is specific to the
new set; the brief covers the house style that carries over unchanged.

---

## What to upload in the first message

**From this starter kit:**

| File | Why |
| --- | --- |
| `STYLE_BRIEF.md` | audience, motivation, the five principles, voice, module template, working practice |
| `KICKOFF-SPECTRAL.md` | this file |
| `assets/style.css` | the entire visual identity — reuse unchanged |
| `assets/seismic.js` | wavelets, synthetic traces, **FFT**, Hilbert, spectra, colormaps, canvas helpers |
| `assets/attributes.js` | semblance, dip scanning, covariance and eigen machinery |
| `assets/count.js` | page-view counting, drops in unchanged |
| `modules/curvature.html` | the most complete finished module — use as the structural template |
| `ADD-COUNTING.md` | the counting procedure |

**And add yourself:**

- **The AASPI documentation** for the spectral programs (`spec_cwt`, `spec_cmp`,
  `spec_max_entropy`, and whatever else the set will cover). This is the single
  most important upload. In the geometric attributes set, every definition,
  every equation number and every stated departure from production software came
  from the documentation, and where it contradicted itself the module said so.
- Any figure you already use in lectures that the modules should be able to
  reproduce or improve on.

## What already exists that you will not have to build

`assets/seismic.js` already contains, tested and in use:

- `fft` — a working complex FFT, and `fkSpectrum`
- `spectrum` — amplitude spectrum of a trace
- `makeWavelet` / `ricker` / `ormsby` — including a banded Ormsby, which matters
  for showing what bandwidth does
- `phaseRotate` and `hilbert` — the analytic trace, verified against a cosine
- `traceFromSpikes`, `rc`, `bandLimitedNoise` — synthetic trace construction
- `drawVarDensity`, `drawWiggle`, `COLORMAPS`, `SEQMAPS`, axes, color bars
- `readState` / `writeState` — shareable URL state

**What will need adding:** a short-time Fourier transform with a selectable
window, a continuous wavelet transform, probably an S-transform, and an RGB
blend helper. Everything else is there.

## The through-line

Every module set needs a spine or it reads as a catalogue. For the geometric
attributes it was *everything is a derivative of dip and inherits its errors*.

**The proposed spine here: a seismic trace does not have a frequency, it has a
spectrum — and what you can see depends on which part of that spectrum you look
at.** A bed that is invisible at one frequency is obvious at another. Every
spectral attribute is a way of asking that question, and every one of them
trades time resolution against frequency resolution to do it.

That spine gives the set two recurring arguments, both of which can be
demonstrated rather than asserted:

1. **The uncertainty trade.** You cannot have sharp time and sharp frequency at
   once. Every method in the set is a different compromise, and the reader
   should watch the compromise happening rather than be told about it.
2. **Tuning is not a nuisance, it is information.** The notch in the spectrum
   tells you the thickness. This connects the set directly to your resolution
   modules, and makes the pairing explicit.

Test the spine against the AASPI documentation before building. If it does not
fit what the programs actually do, change it — but do not start without one.

## Proposed module sequence — provisional

Confirm against the documentation before building anything.

| # | Module | Question |
| --- | --- | --- |
| 01 | What a spectrum is | A trace is a sum of frequencies. What bandwidth means, and what it costs. |
| 02 | Time and frequency together | Why you cannot have both. The window-length trade, watched happening. |
| 03 | The methods | STFT, CWT, S-transform, matching pursuit — same trace, four answers. |
| 04 | Tuning and the thin bed | Where the notch comes from, and reading thickness out of it. |
| 05 | Peak frequency and peak magnitude | Turning a spectrum at every sample into an attribute volume. |
| 06 | RGB blending | Three frequencies, three colors, one image — and how it misleads. |
| 07 | Spectral balancing | What whitening does to the wavelet, and to the noise. |
| 08 | Attenuation and low-frequency shadows | When a spectral change is the reservoir and when it is the overburden. |

Module 04 is the natural hinge to your resolution set, and module 01 is the
natural hinge from it. Say so on both sites.

## Build order

1. Confirm the spine against the documentation.
2. Fix the module list and write out the one question each module answers,
   before any code.
3. Add the missing library functions to `assets/seismic.js` and **verify each one
   against a case with a known answer** — an STFT of a pure tone, a CWT of a
   delta, a spectrum whose notch spacing is known from the bed thickness. The
   geometric set's verification table was built this way and it caught real
   errors.
4. Build module 01 **completely** — steps, Why it matters, Exercises with hints,
   Key points, Method, verification — before starting module 02. The template
   settles far faster that way.
5. Only then build the rest, then the landing page, then the README, then the
   SSRN paper.

## Things to carry over without rediscovering them

- Square plot boxes for square grids; fixed axes on anything a slider drives;
  a color bar on every map; cyclic scales for cyclic quantities.
- Canvas width from the parent's **content** box, not `clientWidth`.
- `SEIS.tag` writes white text into a box filled with the color you pass.
- Keep the total tab-label length under ~115 characters or the strip wraps.
- Measure every number that appears in the prose. Build the headless harness
  early — it is the measurement instrument, not just a test.
- When a measurement contradicts the teaching text, the text is wrong.

## A first message that works

> I want to build a new set of interactive teaching modules, *How Spectral
> Attributes Actually Work*, in the same style as my geometric attributes site.
>
> Attached: the style brief, the kickoff notes, the shared assets, one finished
> module as a template, and the AASPI documentation for the spectral programs.
>
> Start by reading the style brief and the kickoff notes, then the AASPI
> documentation. Then tell me whether the proposed spine and module list hold up
> against what the programs actually do, and what you would change. Do not write
> any code yet.

Asking for the plan first is worth a message. The geometric set's structure
changed after the documentation was read, and it was better for it.

---

*Companion to* How Geometric Attributes Actually Work,
https://hbedle-subsurface.github.io/geometric-attributes/
