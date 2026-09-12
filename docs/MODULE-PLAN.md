# Module plan — *How Spectral Attributes Actually Work*

Settled before any module was built. Read with `STYLE_BRIEF.md`, which carries
the house style, and `KICKOFF-SPECTRAL.md`, which carries the original proposal
this plan revises.

---

## Audience

Beginners. Undergraduates meeting the topic for the first time, graduate students
in geology whose research depends on tools they did not build, and professionals
who arrived in interpretation from an adjacent discipline. The goal is
**foundational understanding and correct vocabulary**, not coverage. A reader who
finishes the set should be able to hold a conversation about spectral
decomposition without bluffing, and should recognize the terms they will meet in
their first month on a workstation.

This is why the set is ten modules and not fourteen, and why several real AASPI
programs are named on the landing page rather than given modules.

## Spine

**A trace does not have a frequency, it has a spectrum — and what you can see
depends on which part of that spectrum you look at.**

The deeper argument, that every spectral method is a projection onto an assumed
basis and inherits that basis's assumptions, is real and is what distinguishes
the AASPI programs from one another. It is deliberately held back to module 08:
it is a thing you appreciate after you already know several methods, not a thing
to open a beginner set with.

## Ordering rule

Each module depends only on those before it. Two orderings are deliberate and
should not be casually rearranged:

- **04 before 05.** Tuning is taught on a clean synthetic with a known wavelet,
  where the notch behaves. Module 05 then reveals that real data ruins it unless
  the wavelet is dealt with first. The problem, then the fix.
- **05 before 06.** Peak frequency only estimates tuning thickness on balanced
  data. Every claim in 06 rests on 05.

---

## The modules

Module 00 was added after this plan was first written, so the numbered list
below starts at 01. It gives the geological motivation on a channel model, in
the manner of Partyka, Gridley and Lopez, and is now the recommended entry
point. That makes ten modules in total.

### 01 — What a spectrum is
**Question:** If a trace doesn't have "a frequency," what does it have?
**Terms:** amplitude spectrum, phase spectrum, bandwidth, dominant frequency,
peak frequency, octave, low-cut, high-cut, Nyquist, broadband.
**Opens on:** one trace, its spectrum, and a wavelet whose bandwidth the reader
can widen and narrow. The cost of bandwidth shows up in the wavelet's sidelobes,
where it can be seen rather than asserted.
**AASPI content:** none.

### 02 — Why one spectrum isn't enough
**Question:** Where in the trace did that frequency come from?
**Terms:** stationarity, analysis window, window length, time-frequency plot,
spectrogram, time resolution vs frequency resolution.
**Opens on:** a trace with an obvious change partway down, and a whole-trace
spectrum that hides it completely.
**AASPI content:** none. The 40 ms window / 25 Hz floor is a general fact and can
be quoted as one.

### 03 — What comes out of spectral decomposition
**Question:** I have a volume called `spec_mag_20`. What am I looking at?
**Terms:** spectral component, voice, magnitude, phase, iso-frequency slice,
4D volume, decomposition frequency, frequency increment.
**Opens on:** the 20 Hz voice beside the trace it came from, so the "narrow
bandpass filter" equivalence lands before the vocabulary does.
**Carries:** the 2πft phase correction, as one step. Phase is meaningless to a
beginner until they see the version that tracks geology instead of traveltime.
**AASPI content:** file-naming conventions only, so the reader recognizes what
lands on their disk.

### 04 — Tuning and the thin bed
**Question:** Why does a bed vanish at one frequency and shout at another?
**Terms:** tuning, tuning thickness, notch, thin bed, resolution limit,
T = 1/(2·f_peak).
**Opens on:** a wedge, unambiguous at the thick end and ambiguous at the thin
end.
**Must show both:** the doublet relation T = 1/(2·f_peak), which is exact, and
the amplitude-tuning thickness of a specific wavelet, which is not the same
number (13 ms vs 16.7 ms for a 30 Hz Ricker). Beginners conflate these. Name the
difference.
**Hinge:** to the seismic resolution modules. Say so on both sites.
**AASPI content:** the tuning relation.

### 05 — Spectral balancing
**Question:** Is that map showing me the geology or the source wavelet?
**Terms:** spectral balancing, whitening, prewhitening, bluing, time-variant,
survey-average vs trace-by-trace.
**Opens on:** a peak frequency map of unbalanced data that looks like structure
and isn't.
**Carries the warning:** trace-by-trace balancing can remove the geologic feature
you were looking for, because a notch that is not statistically averaged out gets
whitened away. This is why `spec_cwt` and `spec_cmp` use a survey-average
operator.
**AASPI content:** α prewhitening, bluing exponent β, the Ormsby corners.

### 06 — Peak frequency and peak magnitude
**Question:** How does a spectrum everywhere become one picture?
**Terms:** peak frequency, peak magnitude, peak phase, mean frequency, peak
magnitude above average, attribute volume, time slice.
**Opens on:** the spectrum at a single sample, then the same operation run
everywhere.
**AASPI content:** the named outputs, so the reader recognizes them in a GUI.

### 07 — Blending, and its traps
**Question:** What do the colors in that image actually mean?
**Terms:** RGB blend, channel, corender, hue-lightness modulation, opacity,
color bar.
**Opens on:** three frequencies already blended, with the reader able to pull
them apart again.
**The trap:** peak frequency is close to meaningless where peak magnitude is near
zero, which is exactly where a hue-lightness display goes dark. Show it.
**AASPI content:** `corender` and `hlplot`.

### 08 — Why there is more than one program
**Question:** The menu has three programs. Which one, and why?
**Terms:** CWT, Morlet wavelet, matching pursuit, atom, maximum entropy, sparse,
reconstruction, residual.
**Opens on:** one trace, three answers that disagree. The disagreement is the
lesson.
**Where the spine finally lands:** each method assumes something, and the
attribute is only as good as the assumption. Also where the uncertainty trade
gets its caveat — a model-based method can beat the Heisenberg product for
signals that fit the model, and fail badly for signals that don't.
**AASPI content:** fully. `spec_cwt`, `spec_cmp`, `spec_max_entropy`.

### 09 — When a spectral change isn't the reservoir
**Question:** I found a spectral anomaly. What else could it be?
**Terms:** low-frequency shadow, attenuation, Q, overburden effect, artifact,
tuning ambiguity.
**Opens on:** two anomalies that look identical and have different causes.
**Must state:** there is no Q estimation program in the AASPI documentation this
set was built against. This module teaches interpretation caution, not an
algorithm, and the Method section says so plainly.

---

## Deliberately out of scope

Real, useful, and wrong for a beginner set. These get a paragraph each in a
**"What else AASPI does"** section on the landing page — program name, the
one-line idea, the reference — rather than a module. That keeps the documentation
honest and gives an advanced reader a thread to pull, at the cost of one page
instead of six modules.

| Left out | Why |
| --- | --- |
| Spectral slope, roughness, kurtosis, skewness | Statistics vocabulary before the reader can read a peak frequency map. |
| Phase residues | Needs phase fluency this set doesn't build. |
| Bandwidth extension (WTMML and doublet-based) | Two algorithms, one sparse assumption, no beginner payoff. |
| `thin_bed_decomposition` | As above. |
| `spectral_probe` | Gao's fault result is lovely; the documentation is 700 words. |
| `spec_vmd` | Documentation is 650 words and its opening line is copy-pasted from `spec_cwt`. |
| `kxky_cwt` | A spatial transform hanging off a temporal set. Would need its own hinge. |

If the page counts justify it later, these are the spine of a second, advanced
set rather than additions to this one.

## Terminology discipline

- "Resolution" is defined once, in module 04, against the definition used in the
  seismic resolution modules. A term that means two things across two of these
  sites is worse than a term the reader hasn't met.
- Where the AASPI documentation contradicts itself, the module says so rather
  than quietly choosing. The known cases: bandwidth defined two ways across
  programs; the prewhitening constant given as 1%, 2% and 4%;
  `spec_max_entropy` and `spec_clssa` used interchangeably; and the Morlet
  variance/bandwidth transposition in `spec_cwt` Figures 4 and 5.
- American spelling throughout: color, center, normalized, gray, meters,
  behavior, license.
