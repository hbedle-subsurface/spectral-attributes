# Bringing the spectral modules down to the undergraduate level

Read with `STYLE_BRIEF.md`, which still governs everything not contradicted
here. This file records what was changed in module 01 and why, so the remaining
nine can be changed the same way rather than each finding its own compromise.

The starting problem, measured across the three sets:

| set | words per module | mean words per sentence | sentences over 30 words |
| --- | --- | --- | --- |
| seismic resolution | 1,840 | 15.7 | 3% |
| geometric attributes | 3,723 | 18.8 | 13% |
| spectral attributes | 4,118 | 20.5 | 19% |

The spectral modules were carrying 2.2 times the reading of a resolution module
before the student touched a control. The computation was not the problem and
was not changed. What follows is a change to the teaching layer only.

---

## 1. Keep the code. Rewrite the words.

Every module in this set has been measured against a harness and the physics
holds. A rewrite that touches `drawStepN` starts the verification over for no
gain. Module 01 was rewritten by replacing the markup above
`<script src="../assets/count.js">` and leaving the script block intact, with
three small additions:

- the preset buttons, which set an existing slider and nothing else,
- one new readout, `s1lam`, which is `VREF / peak`,
- a null guard on the readout that was removed from the markup.

That is the whole diff to the JavaScript. Any module can be rewritten the same
way.

## 2. Target lengths

- **Step lede**: 120–160 words, in two paragraphs. Was 200–260.
- **Legend after a plot**: 90–120 words, one bolded claim then the evidence.
  Two legends on a step is the ceiling.
- **Whole module**: about 2,400 words. Module 01 went 3,849 → 2,400.

Sentences: aim for a mean near 16 words, which is where the resolution modules
sit. Anything over 30 words gets split.

## 3. Say what a thing is before saying what it is not

Retitle away from reversal. Module 01 went from *A trace does not have a
frequency. It has a spectrum.* to *What a seismic wavelet is made of*. Defining
a topic by what it isn't defines nothing for someone meeting it for the first
time, and the pattern is on the list of tics to avoid.

The same edit is owed by at least these:

| module | current headline | the problem |
| --- | --- | --- |
| 02 | *Why one spectrum isn't enough* | names an absence |
| 04 | *Tuning is not a nuisance. It is the measurement.* | reversal, and assumes the reader already thought it was a nuisance |
| 09 | *When a spectral change isn't the reservoir* | names an absence |

## 4. Anchor the opening in rock

The resolution modules open on named rocks — sand encased in shale, gas sand,
coal seam, limestone between shales. A student picks one and has something to
think with. The spectral modules opened on a Ricker and four Ormsby corners.

Module 01 gained three survey presets — deep target, land 3D, shallow — that set
the peak frequency to 15, 30 and 55 Hz. Presets that set existing controls cost
nothing in verification and give the module a way in.

Where a module already has an earth model (00, 04, 05, 06, 07, 09), the presets
should name geology instead: a channel, a gas sand, a coal, a thick shale.

## 5. Give each step a question, in a `.qbox`

At the top of every step pane, before the explanation:

```html
<p class="qbox"><b>The question this answers.</b> A processing report says the
  data are 30 Hz. A well tie says 24 Hz. An attribute volume says 34 Hz at the
  same place. What is each of those numbers measuring?</p>
```

The situation, not the concept. A step that cannot be given one is usually a
step that is carrying someone else's material.

## 6. Plain instruction, not turned phrases

The rewrite is for students who are decoding the concept. Any sentence that also
has to be decoded costs them twice. The pass that fixed this removed:

| Removed | Replaced with |
| --- | --- |
| *The shape arrives late.* | *Most of the wavelet's shape comes from the combination of components rather than from the strongest ones.* |
| *Two different costs, two different sliders.* | *Raising the high cut narrows the central lobe; sharpening the corners lengthens the tail.* |
| *Buy resolution, then fail to buy it.* | *Widen the spectrum two ways and compare the results.* |
| *Make a signal lie about its frequency.* | *Record a frequency above the Nyquist limit.* |
| *two bright rails*, *the illuminated part walks*, *a slow swell* | *two bright lines*, *the brightest part moves*, *a single low-frequency oscillation* |
| *which is nowhere* | the measured change, stated |
| *Levees? Two channels? An incision edge?* | *What produces that pattern?* |

The rules that produced those replacements:

- **A legend heading states the finding**, in a full sentence, naming the
  quantity that changed and the mechanism. It is not a slogan.
- **No metaphor for a physical effect.** Reflections do not travel, walk, shout
  or vanish; amplitudes rise and fall, and features are bright or dark.
- **No rhetorical fragments**, in a question box or anywhere else. A question
  box asks one complete question.
- **No "not X" where a positive statement works.** *The brightest part marks a
  particular fill thickness rather than the thickest fill* beats *the bright part
  is not the thick part*.
- **Exercise rationale is labeled `Why:`**, not `The point:`, and states the
  situation the exercise prepares for.
- **Step headings name the subject**, not the lesson: *The high cut and the
  corner taper*, not *What the high end buys, and what a sharp edge costs*.

After the pass, module 01's prose sits at a 15.3-word mean sentence with 4% over
thirty words, against 20.5 and 19% in the original.

## 7. Move numbers out of the prose

Measured figures belong in the readouts, the legend after the plot, and the
exercise hints. A step lede with four numbers in it reads as a wall. Module 01's
ledes now carry none; the legends carry them, and the hints carry the rest.

Every figure that survives must still be read out of the harness. That rule does
not relax.

## 8. Structure of an explanation

First what the quantity measures — arithmetic, on the wavelet or the trace.
Then, in a separate paragraph or legend, what it tends to correspond to in the
earth. Module 01's step 1 does this with two legends: one on peak versus mean
frequency, one on wavelength in rock. The second never claims the first.

## 9. Descriptive, not prescriptive

Removed from module 01: *you will want to remember which is which*, *two curves
every interpreter should know by heart*, *ask whether the central lobe got
narrower*, *Know your sample interval before you ask a decomposition for a
frequency*.

Operating instructions stay imperative and short — *Move the peak frequency
slider and both pictures move together* — because they tell the student what to
do with the tool. Conclusions are stated as facts about the method.

## 10. The exercises are a separate pass — do not skip them

Module 02's first pass rewrote the ledes and legends, added the question boxes
and the glossary, and left the exercise block untouched. The measurements looked
finished — mean sentence 17.7, five question boxes — while the exercises still
carried zero `Why:` lines and four second-person constructions. The two
statistics that would have caught it are not the prose ones.

**Check all four counts before calling a module done:**

```
qbox        should be 5
terms       should be 1
Why:        should be 5 or 6, one per exercise
2nd-person  should be 0, measured over the WHOLE file
```

The last one matters most: scan the whole file, not the prose blocks. `you`,
`your`, `you are`, `you should` survive in exercise hints and in `Why it
matters` bullets long after the ledes are clean.

## 11. Exercises: five, each with a reason

```html
<li><b>Buy resolution, then fail to buy it.</b>
  <em class="point">Why: this is the test that separates a genuine resolution gain
    from a lengthened wavelet.</em>
  In step 3, first take the high cut from 25 to 110 Hz…
  <details class="reveal"><summary>Hint</summary><span class="ans">…</span></details></li>
```

Five, not six. The `.point` line goes between the instruction and the steps to
carry it out, so a student knows what the exercise is for before starting it. It
opens with `Why:` and states a situation, not a slogan. The
prediction prompt (`.predict`) stays on the first exercise only.

## 12. Two reference blocks at the end

- **If you remember nothing else** — the old *Key points*, retitled and cut to
  short bullets. Six.
- **Words introduced here** — a `<dl class="terms">` glossary. Beginners meet
  eight to twelve new words per module and need somewhere to check one without
  rereading the step it appeared in. This is what the module plan means by
  correct vocabulary, and nothing else in the template delivers it.

## 13. A module's name lives in five places

The `<h1>` is canonical. The others are set from it:

- `<title>`, as `<h1> | How Spectral Attributes Actually Work`
- the index card, `<h3><a href="modules/X.html">`
- the README table row
- the next-up card in the preceding module, `<h3>NN · name</h3>`
- the pager link in the neighbouring modules, `Module NN: name`

Before this was enforced, seven of the ten modules were named three different
ways and **all ten** had a `<title>` matching nothing else. A student clicking a
card labelled "Spectral balancing" landed on a page headed "Is that a map of the
geology, or of the source wavelet?", and the browser tab said something else
again.

Retitling means changing the `<h1>` and propagating to all five. Two were
retitled in this pass, both for the reason in section 3: **04** from *Tuning is
not a nuisance. It is the measurement.* to *Tuning, and what a thin bed does to
amplitude*, and **02** from *Why one spectrum isn't enough* to *Putting a window
on the trace*.

## 14. Housekeeping owed by all ten modules

- `assets/popout.js` is now present. Add
  `<script src="../assets/popout.js"></script>` next to `count.js` in each
  module. See `ADD-POPOUT.md`; no markup or stylesheet change is needed.
- Footers carried the superseded free-for-teaching terms. Replace with the
  CC BY-SA 4.0 block now in `modules/spectrum.html`, and credit
  **Dr. Heather Bedle and Dr. April Moreno-Ward**. `LICENSE.md` is updated.
- `index.html` needs the same license and attribution change, and its module
  cards need retitling to match section 3.

## 15. Every step must have something to move

Audited across the set, seven step panes had no live control at all: the pinned
header was hidden for that tab and the pane carried none of its own. A student
on module 00 step 2 was reading a legend about what happens when the wavelet
frequency changes, with no way to change it.

The pinned header is the intended answer — it is sticky, so its sliders and its
live panel stay on screen while the step is read. The fix was to stop hiding it:

```js
lab.hidden = !(id === 'p1' || id === 'p2' || id === 'p3' || id === 'p4' || id === 'p5');
```

applied in `why`, `spectrum`, `blending`, `components`, `methods` and `tuning`.

**In-pane controls are still worth adding** where a step has a parameter the
header does not carry. Module 00 and module 01 both gained an interval-velocity
slider in step 1, which turns a frozen "at 2500 m/s" caption into a live
conversion and lets a student watch wavelength grow with rock velocity. That is
the test for a new slider: it should expose a relationship the header cannot,
not duplicate a header control.

The rule for the remaining eight rewrites: **check the labhead condition
first**, then ask whether the step has a quantity of its own worth driving.

## 16. Every module needs a seismic section

Audited across the set, only three modules ever draw a seismic section, and two
of those draw it once in the header and never again. The rest reduce their model
to spectra, curves and maps before anything reaches the screen.

| Module | What a student sees | Section? |
| --- | --- | --- |
| 00 `why` | channel maps in plan view | plan view only |
| 01 `spectrum` | wavelet and spectrum | not applicable |
| 02 `windows` | one trace, spectra, spectrogram | no |
| 03 `components` | trace, time-frequency panels | step 4 only |
| 04 `tuning` | wedge section in the header, then curves | header only |
| 05 `balancing` | spectra and curves throughout | **added in step 3** |
| 06 `attributes` | channel maps in plan view | plan view only |
| 07 `blending` | channel maps in plan view | plan view only |
| 08 `methods` | one trace, time-frequency panels | no |
| 09 `shadows` | peak-frequency curves | no |

The models already contain the seismic. Module 05 holds a full wedge of 100
traces and never drew one of them as an image. Adding a section is therefore
assembly, not new physics.

`SEIS.drawSectionPanel(ctx, traces, rect, opts)` in `assets/seismic.js` does the
whole panel: variable-density image, wiggle overlay, both axes, gray colormap.
It returns the clip it used, so a before/after pair can be drawn on a shared
amplitude scale by passing the first panel's return value to the second — which
is the whole point of a before/after pair.

Module 05 step 3 now shows the recorded wedge beside the balanced wedge, with a
readout counting how many events one trace crosses in each. At α = 0.1% the
count goes 6 → 10: the four extra events are the sharpened wavelet's sidelobes,
and on a section they look exactly like reflectors. The module already made that
argument in prose; the section is what makes it land for a geologist.

**Priority for the remaining modules:** 04 `tuning` first, since it argues about
bed thickness and shows the wedge only once; then 09 `shadows`, where a
low-frequency shadow beneath a gas sand is the most visual result in the set and
is currently a line plot. 02 and 08 are about signal-processing machinery, and a
single trace is the honest display for them.

## 17. Display faults found by looking at the rendered page

Three of these were invisible in the source and obvious on screen. Check a
rendered module, not only its markup.

**The rotated y-axis label was clipped in four modules.** `SEIS.axisLeft` placed
it at a hardcoded `rect.x - 42`, but each module sets its own `M.l`. Wherever
that margin was 52 or less the label was drawn past the left edge of the canvas
and only a narrow vertical sliver of each glyph survived, which reads on screen
as a column of dots. Affected `why`, `attributes`, `blending` and `methods`. The
label is now placed from the measured width of the widest tick label and clamped
so its glyph body cannot leave the canvas.

**A moving profile needs its position drawn on the map it came from.** Module 00
step 4 has a slider that moves a profile up and down the channel, and the
profile plot alone gave no indication where the line was. The header map now
carries the line and a marker while step 4 is open. Any module with a location
slider owes the same: a readout of a position is not a picture of it.

**An RGB blend cannot be read backwards into its inputs.** Module 00 step 5
showed the blend and asked the student to accept that three frequencies were in
it. It now shows the three maps first, one per panel, each drawn in the single
color channel it contributes, then the combination. The legend names what each
mixture means: red and green give yellow, green and blue give cyan, all three
give white. The same treatment is owed by module 07, which is entirely about
blends.

## 18. Reuse the cross-sections from the companion sets

`assets/strata.js` is new, and almost none of it is new work. It carries two
things across from the other repositories rather than reinventing them:

- **`ROCKS`** is the lithology table from the seismic resolution set,
  `modules/model1d.html` (`PRESETS`) — velocities in m/s and densities in g/cc
  for shale, sand, wet sand, gas sand, limestone, coal and sandstone. Those are
  the numbers that set was built and checked against, so a student who has
  worked through it meets the same rocks here.
- **The layer construction** follows `modules/faults.html` in the same set
  (`buildLayers`): reflection-coefficient signs alternate about 82% of the time
  rather than at random, because a pure coin flip lets impedance wander in one
  direction and the model reads as a gradient instead of as beds.

What is genuinely new is the **target bed**: one named bed inside the package
whose thickness varies across the section, so a single display shows the same
bed above tuning, at tuning and below it, with stratigraphy around it. Neither
companion set has that, and it is what the spectral modules need.

`STRATA.buildSection(opt)` returns the traces plus the true `thickness[ix]`, so
any measurement made off the section can be checked against what the model
contains. `STRATA.markTarget()` draws the true top and base over a section
already rendered by `SEIS.drawSectionPanel()`.

Module 04 step 1 now uses both, with a five-way lithology selector. The
reflection coefficients fall out of the rock properties rather than being
chosen, and the result is a lesson the clean wedge cannot teach:

| Target | RC | Against background bedding |
| --- | --- | --- |
| Coal in sandstone | &minus;0.393 | 5.32× — clearly visible |
| Limestone in shale | +0.337 | 4.56× — clearly visible |
| Gas sand in shale | &minus;0.207 | 2.81× — clearly visible |
| Sand in shale | +0.026 | 0.36× — weaker than bedding |
| Wet sand in shale | +0.004 | 0.05× — weaker than bedding |

A wet sand in shale is not separable from ordinary bedding at any thickness.
Tuning describes how a visible bed behaves as it thins; it does not make an
invisible bed appear. On a wedge with a chosen RC of ±0.1 that point cannot be
made at all.

**Still owed a section:** module 09, where a low-frequency shadow beneath a gas
sand should be shown on a section rather than as a line plot — `gasInShale` is
already in the table for it. Modules 02 and 08 are about the machinery of the
transform, and one trace remains the honest display there.

**Harnesses:** every harness now inlines `assets/strata.js` alongside
`seismic.js` and `spectral.js`. A module that uses `STRATA` without that line
throws on load.

## 19. Let the student change the seismic before the method touches it

A geology student should be able to degrade the data themselves — lower the
frequency, raise the noise — and watch the section get harder to interpret,
before any spectral method is applied to it. Where that is possible now:

| Module | Frequency | Noise | Seen on a section? |
| --- | --- | --- | --- |
| 00 `why` | yes | **no** | plan-view maps only |
| 01 `spectrum` | yes | n/a | wavelet only |
| 02 `windows` | no | no | one trace |
| 03 `components` | yes | **no** | step 4 only |
| 04 `tuning` | yes | yes | **yes, on all five steps** |
| 05 `balancing` | yes | yes | **yes, step 3** |
| 06 `attributes` | yes | yes | plan-view maps only |
| 07 `blending` | yes | **no** | plan-view maps only |
| 08 `methods` | yes | yes | one trace |
| 09 `shadows` | yes | **no** | none |

Module 04 is the pattern. Both sliders sit on the pinned header, the
stratigraphic section is on screen while they move, and a readout reports the
thinnest part of the bed that can still be followed:

| | traceable down to |
| --- | --- |
| 18 Hz, no noise | 4.5 ms |
| 30 Hz, no noise | 1.5 ms |
| 45 Hz, no noise | 1.1 ms |
| 30 Hz, 10% noise | 1.5 ms |
| 30 Hz, 30% noise | 3.4 ms |
| 30 Hz, 60% noise | 7.9 ms |

**A trap worth recording.** The first version of that readout compared the peak
amplitude in the target window against the mean amplitude away from it, both
measured on the noisy section. Noise raises both, and a single noise spike
inside the window satisfies the test on its own, so the readout said a buried
bed was *more* traceable than a clean one. The fix builds the section twice with
the same seed, once without noise, so the difference between the builds is the
noise and the clean build is the signal; the bed then has to clear twice
whichever is larger, the bedding RMS or the noise RMS. Both quantities must be
amplitudes — the intermediate version compared an amplitude against a raw
reflection coefficient and was still wrong.

`harness-04` now asserts monotonicity in both directions: a higher frequency
must follow the bed to a thinner point, and added noise must never follow it
further. Any readout of this kind needs that check; the failure was invisible in
the code and obvious in the numbers.

**Gaps to close:** modules 00, 03, 07 and 09 have no noise control at all, so
their data are perfectly clean and a student cannot ask what happens when they
are not. Module 09 needs it most, since attenuation beneath a gas sand competes
directly with noise as an explanation for a low-frequency anomaly.

## 20. Module 09: the shadow as a picture

Module 09 worked entirely on four isolated traces, one per cause. That keeps the
causes separate, but nobody meets a low-frequency shadow that way. On real data
it is a laterally confined zone of dim, low-frequency reflections underneath a
body, and recognising that picture is the skill the module exists to build.

Step 3 now carries a section: a layered package from `strata.js` with a gas sand
at 150 ms covering part of the line, attenuation applied only to the traces that
pass through it, and the body's edges drawn on. Two new sliders — the width of
the sand and the noise — sit with the panel. Taking the width to zero removes
the shadow, which is the control.

Measured at 620 ms with Q = 30 and clean data: about 35 Hz off the body, 11.8 Hz
under it, a 23.5 Hz drop.

**Three model faults this exposed, all invisible in the code.**

*The measurement was too shallow.* Taken at the target level, 150 ms below the
sand, the drop was 1.3 Hz — the module's main diagnostic looked useless because
absorption had not had the travel time to accumulate. Moved to 620 ms.

*The confidence test was against a fixed number of hertz*, which says nothing
once there is noise. It now compares the drop against the trace-to-trace scatter
of the measurement made off the body — the test an interpreter would apply.

*Every off-body trace was identical*, so that scatter was exactly zero and the
readout reported infinite confidence. Perturbing bed strengths did not fix it:
peak frequency is set by the spacing of the beds, not their amplitudes. The bed
*times* had to move too, a few milliseconds, which is what mild structure does.
`harness-09` now fails if the readout ever prints `Infinity`.

**And one result worth teaching that fell out of it.** Raising the noise to 10%
does not weaken the shadow, it reverses it: the measurement under the body reads
about 12 Hz *higher* than off it. A shadow zone is dim by definition, since the
energy that made it low-frequency is energy it lost, so noise dominates there
while the brighter section either side is still readable — and the peak
frequency of noise is not low. The readout says `reversed — noise has taken the
shadow zone` rather than reporting a small positive number. A first version
would have shown a shrinking positive drop and taught the opposite.

## 21. Stylesheet additions

Four changes to `assets/style.css`, all additive:

- `--teal: #0B7285` added to `:root`. It was referenced by `.tryit .predict` and
  never defined, so that block has been rendering with no left border since it
  was written.
- `.qbox` — the step question.
- `.tryit .point` — the exercise rationale line.
- `.terms` — the glossary list.
- `.tri-row` — three panels abreast, for the separate maps behind a blend.
- `.hero-panel svg` — the landing page hero holds a static SVG rather than the
  live canvas the geometric page uses, and needed the same sizing rule.

## 22. Order to work through

**All ten are done.** Measured after each pass:

| module | words | mean sentence | over 30w | qbox | glossary | `Why:` |
| --- | --- | --- | --- | --- | --- | --- |
| 00 `why` | 2267 | 17.2 | 11% | 5 | yes | 5 |
| 01 `spectrum` | 1988 | 15.3 | 4% | 5 | yes | 5 |
| 02 `windows` | 1863 | 17.7 | 12% | 5 | yes | 5 |
| 03 `components` | 1605 | 17.6 | 14% | 5 | yes | 6 |
| 04 `tuning` | 2207 | 19.5 | 14% | 5 | yes | 6 |
| 05 `balancing` | 1610 | 17.5 | 14% | 5 | yes | 6 |
| 06 `attributes` | 1372 | 16.0 | 6% | 5 | yes | 6 |
| 07 `blending` | 1692 | 17.3 | 10% | 5 | yes | 7 |
| 08 `methods` | 1237 | 18.2 | 10% | 5 | yes | 6 |
| 09 `shadows` | 1959 | 17.8 | 15% | 5 | yes | 5 |

Where the set started: a mean of 20.5 words per sentence with 19% of sentences
over thirty, against the seismic resolution set's 15.7 and 3%. It now averages
17.4 and 11%, with a question box on every step, a glossary in every module and
a stated reason on every exercise. Every harness passes on its original numbers,
because no computation was touched in any of the ten.

**Noise controls are now on eight of the ten.** `spectrum` and `windows` do not
have one and should not: module 01 is about a wavelet with no earth in it, and
module 02 builds a two-event trace to isolate the time-frequency trade. Noise
there would obscure the thing being shown.

Two findings came out of adding them, both worth keeping:

- **Module 00.** On clean data the blend covers 87% of the channel against 73%
  for the full-bandwidth map. At 10% noise that is 79% against 58%, at 20% it is
  59% against 49%, and at 40% the order reverses: 21% against 35%. Each
  iso-frequency component uses a narrow slice of the band, so it carries a small
  share of the signal energy while competing with noise spread across the whole
  spectrum. The blend's advantage on clean data is real and not unconditional.
- **Module 07** already applied noise, hardcoded at 4% and not exposed. The
  default is unchanged so existing shared links render as before.

`harness-00` and `harness-07` now assert that noise never improves coverage,
the same monotonicity check `harness-04` and `harness-09` carry.

**Sections: the audit was overstated.** I listed modules 03 and 07 as owing one.
Module 03 already draws a wedge seismic line in step 4, and module 07 is
entirely about map display, where plan view is the correct form. Neither needs
one. Sections stand at four modules — 03, 04, 05 and 09 — and that is the right
number.

**What is actually left:**

1. **The SSRN link.** `node set-ssrn.js <url>` fills all thirteen places at
   once; `--check` reports where the placeholder still is.
2. **April Moreno-Ward's ORCID**, when known. Heather Bedle's is in `README.md`
   and `LICENSE.md`.
3. **The axis-label fix ported** to the geometric attributes and seismic
   resolution repositories. Patched copies of `seismic.js` and a note are in
   `axis-fix-for-companion-repos/` alongside this repository.


### Second person: what to leave alone

Three uses are boilerplate shared by every module and are not part of the pass:
the panel caption *every step updates as you drag*, the tab hint *Method and
references are there when you want them*, and the license and privacy lines in
the footer. Everything else goes. Scan with `you` and `your` over the whole
file, not the prose blocks, and exclude those three.

### The cross-check with the seismic resolution set

Module 04 is the hinge, and its terminology now says so explicitly. That set's
**tuning thickness** is this set's **amplitude tuning thickness**: they measure
it at about 1/(2.6f), which is 12.8 ms for a 30 Hz wavelet against the 13.0 ms
measured here. Kallweit and Wood (1982) is the source of the coefficient in
both. The spectral tuning thickness, 1/(2f) or 16.7 ms at 30 Hz, is a different
number and the other set does not use it. Module 04's step 4 and its glossary
both name which is which.

`rewrite_prose.py` at the repository root does the mechanical part: it locates a
prose element by a unique substring and replaces the whole element, so the
source file's line wrapping does not have to be reproduced.
