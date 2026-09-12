# Development notes

Everything a person working *on* this repository needs. The README is the
student-facing landing page and deliberately carries none of this.

## Repository layout

```
index.html                 landing page
modules/                   one self-contained HTML file per module
assets/style.css           the entire visual identity
assets/seismic.js          wavelets, FFT, Hilbert, synthetic traces, drawing
assets/spectral.js         time-frequency math for this set
assets/strata.js           layered geological cross-sections and a rock table
assets/popout.js           opens a module's exercises in a second window
assets/count.js            page-view counting, shared unchanged
LICENSE.md                 CC BY-SA 4.0
verify-spectral.js         known-answer checks for spectral.js
verify-axes.js             axis and orientation checks
harness-NN.js              headless render + readout check for each module
set-ssrn.js                fills the SSRN link into all thirteen places at once
measure-01.js              a standalone measurement run, kept from module 01
make-thumbs.js             regenerates the ten card illustrations on index.html
make-hero.js               regenerates the landing page hero image
docs/                      style brief, rewrite brief, kickoff notes, module
                           plan, counting and popout procedures
```

Each module is a single self-contained HTML file with its own markup and script,
linking only to `style.css`, `seismic.js` and `spectral.js`. A module can be
copied, emailed or opened from disk and still work, and editing one cannot break
another.

`count.js` is still shared verbatim with the other teaching repositories.

**`seismic.js` and `style.css` are no longer.** They were forked in September
2026 and this repository's copies are now its own: about 110 lines of
`seismic.js` and 94 of `style.css` differ from the geometric attributes set.
What was added here:

- `SEIS.drawSectionPanel()` — a complete seismic section panel in one call
- the `axisLeft` label fix described under *The clipped axis label* below
- `--teal` in `:root`, plus `.qbox`, `.tri-row`, `.terms` and `.tryit .point`

Do not try to re-merge them. Edit this repository's copies directly.

**One of those changes is a bug fix the other repositories still need.** The
`axisLeft` label clipping affects any module whose left margin is 52 or less,
and both companion sets have modules in that range. Port that one change back by
hand; leave the rest here.

`spectral.js` and `strata.js` are specific to this set. `strata.js` carries the
rock table and layer construction across from the seismic resolution set — see
its header comment for exactly what came from where.

## Checks to run after every edit

```
node --check <extracted module script>     # syntax
node verify-spectral.js                    # the library, closed-form answers
npm install jsdom                          # once
node harness-00.js                         # module 00
node harness-01.js                         # module 01, every control driven
node harness-02.js                         # module 02
node harness-03.js                         # module 03
node harness-04.js                         # module 04
node harness-05.js                         # module 05
node harness-06.js                         # module 06
node harness-07.js                         # module 07
node harness-08.js                         # module 08
node harness-09.js                         # module 09
```

Also check tag balance and that every `$('id')` in a module resolves to an id
actually present in its markup. Both have caught real breakage.

**The rule that matters: every number in a module's prose, legend or exercise
hint must be printed by that module's harness.** If a measurement contradicts
the teaching text, the text is wrong. So far this has corrected the text or the
code in every module:

- **01** — four prose numbers had been measured on wavelet configurations
  slightly different from the ones the page builds. Also caught statistics being
  computed on the display axis (which truncated a 60 Hz Ricker's tail and broke
  the 2/sqrt(pi) relation), two different quantities both called "the sidelobe",
  and two step-3 sliders that were not independent.
- **02** — the whole-trace spectra in step 1 were not identical as claimed,
  because a Hann taper across the record weighted the two event arrangements
  differently and a low-frequency wavelet was being clipped at the end of the
  record. Step 4 was measuring the event's own bandwidth rather than the
  window's smear, so past a 60 ms window the trade appeared to break; it now
  measures the window with a spike and an endless tone. And leakage was being
  measured outside a fixed 15 Hz band, which sits inside a Hann main lobe but
  outside a boxcar one, and therefore reported the boxcar as the cleaner window.
- **03** — phase wrap counts were including samples with no energy, where the
  phase is rounding error. Step 4 was reporting whichever tuning lobe was
  brighter, so the bright zone hopped backwards at 60 Hz; a wedge tunes again at
  three times the thickness, and the readout now takes the first lobe in from
  the thin end. Ripple was measured across the ends of the filter bank rather
  than its interior.

- **04** — the notch finder started at the spectral peak and walked upward,
  which on a thick bed skips the first notch entirely and reports the second,
  giving a thickness exactly half the truth. The apparent-thickness floor was
  being taken over the pinch-out trace, where the trace is identically zero.
  And two prose claims did not survive measurement: the spectral estimate does
  *not* simply beat the picking floor, it has a working range about one octave
  wide that slides with the wavelet; and shape and spectrum do not give up at
  different thicknesses, they give up together.
- **05** — the balancing operator was lifting frequencies where nothing had been
  recorded, so a 55 Hz wavelet came back with 243% error because the peak search
  was finding amplified noise at 120 Hz; production code applies Ormsby corners
  for this reason and now so does this. Step 5's estimator was peak frequency,
  which survives trace-by-trace whitening almost untouched because the operator
  is monotonic in amplitude and does not move the maximum — the notch is what
  gets destroyed, so the notch is what step 5 measures.

- **06** — two prose claims failed. Mean frequency is usually said to be
  steadier than peak frequency in noise; measured here it is not, correlating
  -0.81 against -0.99 clean and -0.77 against -0.98 at 20% noise, because its
  averaging includes parts of the band carrying no thickness information. And
  switching balancing on *lowers* the peak-frequency correlation with fill from
  -0.99 to -0.82, because this model has one stationary wavelet and there is
  nothing for balancing to remove. Both are now stated as measured.
- **07** — the colour legend was taking its peaks from thickness bins holding a
  handful of pixels, where the average colour is mostly noise; bins now need a
  minimum population. And the claim that evenly spaced frequencies are a poor
  default is contradicted by the coverage metric: 14/46/78 Hz scores 91% against
  88% for a considered 18/30/46. The reason is step 3's scaling — coverage is
  counted after each channel is stretched to its own maximum, and the widest
  spread gains most because its outer components carry the least energy. The
  module now says so, which makes it a better lesson than the one I had written.

- **08** — two library bugs. Matching pursuit measured its peak-picking
  threshold against the *residual*, which shrinks: the real events were removed
  on the first pass, the residual's maximum collapsed to the noise level, and
  from the second pass every ripple cleared the threshold. A trace with five
  reflections came back fitted with 714 atoms and a 0.1% residual — a perfect
  fit to the noise. The threshold is now a fixed fraction of the original
  envelope, with a cap on atoms per iteration. Separately, the matching-pursuit
  time-frequency panel placed each atom's whole spectrum on the single sample at
  its center, so any readout taken at a time that was not exactly an atom center
  returned zero; atoms are now spread over their own duration.
- **09** — attenuation was applied with one fixed travel time to everything
  below the absorbing body, so the loss did not accumulate with depth and the
  shadow was about 2 Hz, making the module's central diagnostic look useless
  when it had simply not been modeled. It is now applied window by window with
  the travel time each window has accumulated. Two framing errors also failed:
  a 12 ms bed tunes at 41.7 Hz, *above* the background, so it is not a
  low-frequency anomaly at all; and a bed on a higher tuning lobe does not read
  low either. The second turned into the better lesson — a 72 ms bed reads
  32.6 Hz against a 32.4 Hz background, so a thick reservoir is invisible on a
  peak frequency map. The shadow test alone also cannot separate attenuation
  from a processing difference, since a different wavelet changes every depth;
  the module now tests above the body as well as below, which separates all four
  causes.

One finding worth keeping: the raw phase wrap rate sits slightly *under* the
component frequency at the top of the band (5.1 per 100 ms at 60 Hz rather than
6). That is not an error — the filter is 16 Hz wide and the trace has more
energy below its center than above, so what gets through rotates a little
slower. The prose says so rather than rounding it away.

A second: whitening removes the wavelet envelope that was disambiguating which
tuning lobe you were on. A tuned bed's comb has equal maxima at 1/(2T), 3/(2T),
5/(2T); unbalanced, the wavelet picks one out, and balanced they are the same
height, so the global maximum hops between lobes and the thickness estimate
jumps by a factor of three. Module 05 takes the lowest strong lobe and says so.
This is what the frequency search range in every spectral program is actually
for.

### Note on the harnesses

jsdom executes inline scripts during parsing, so `seismic.js`, `spectral.js` and
`strata.js` have to be inlined into the document *before* it is handed to jsdom.
Loading them afterwards trips the module's own missing-library banner and every
readout comes back as an em dash. A module that uses `STRATA` in a harness that
does not inline `strata.js` throws `STRATA is not defined` on load — silent in a
browser, loud here.

## Findings from the library verification

- **`spec_cwt`'s Figures 4 and 5 pair their bandwidths with the wrong
  variances.** Measured half-power bandwidths are 0.399 Hz at sigma^2=0.44,
  0.265 at 1.00 and 0.187 at 2.00 — their three quoted numbers, transposed. The
  quantity the documentation calls fB/2 is the *full* half-power bandwidth.
  `spectral.js` takes sigma as primary and derives bandwidth from it.
- **Instantaneous frequency is not peak frequency.** For a Ricker they differ by
  exactly 2/sqrt(pi) = 1.128. Taking the documentation's instruction literally
  fits every matching-pursuit atom with a wavelet 13% too short and leaves 3% of
  the input energy in the residual; corrected, it is 3e-7.
- **Equally spaced versus per-octave frequencies is not a preference.** A
  constant-Q family on a linear grid has bank gain proportional to frequency
  (measured ratio 3.499 across 20-70 Hz against a predicted 3.5), so summing the
  voices blues the trace. On a log grid at 8 per octave the ripple is 0.9% and
  the voices reconstruct after one scalar.
- **Two things beginners conflate.** T = 1/(2*f_peak) is exact for a doublet
  (recovered to 0.2 ms). But a wedge cut with a 30 Hz Ricker peaks in amplitude
  at 13.0 ms, not the 16.7 ms that 1/(2*f_dom) suggests. Module 04 shows both.

## Stated departures from production software

Each module's Method tab carries its own list. Across the set:

- Every transform is normalized so a cosine of amplitude A at the analysis
  frequency returns magnitude A. AASPI does not normalize this way, so absolute
  magnitudes are not comparable; ratios and shapes are.
- Matching pursuit fits envelope peaks one at a time. `spec_cmp` fits all peaks
  above the beta threshold simultaneously. On separated events they agree; on a
  tuned doublet ours carries the bias the documentation warns a greedy algorithm
  carries — shown deliberately in module 08.
- The sparse spectrum stands in for `spec_max_entropy`. Same objective, a
  simpler iteratively reweighted solve.
- There is no Q *estimation* here, and none in the AASPI documentation this set
  was built against. Module 09 teaches what attenuation does to a spectrum, not
  how to invert for it.
- Bandwidth is reported both ways, because `spec_cwt` (half-magnitude points)
  and `spec_cmp` (percentile difference) do not agree.

## Build order

1. Confirm the spine and module list against the AASPI documentation. Done.
2. Add the missing library functions, each verified against a known answer. Done.
3. Module 01, complete. Done — `modules/spectrum.html`.
4. Modules 02 and 03. Done — `modules/windows.html`, `modules/components.html`.
5. Modules 04 and 05. Done — `modules/tuning.html`, `modules/balancing.html`.
6. Module 00, the geological motivation. Done — `modules/why.html`.
7. Modules 06 and 07. Done — `modules/attributes.html`, `modules/blending.html`.
8. Modules 08 and 09. Done — `modules/methods.html`, `modules/shadows.html`.
   All ten modules are now built.
9. Final review pass. Done — see below.
10. The SSRN paper.

## Final review pass

Changes made after reading the whole set as an undergraduate would:

- **The physical chain was missing.** Impedance, reflection coefficient and
  two-way time were used throughout and defined nowhere; they appeared almost
  entirely inside Method sections. Module 00 step 2 now explains all three, and
  modules 03 and 04 point back to it.
- **Four Next-up cards named the next module and linked to the index.** Fixed in
  modules 01, 03, 05 and 07. Module 01's pager now points back to module 00.
- **Frequency resolution was stated as 2/T in module 02 and 1/T in module 08.**
  Both are now given together, as a full width at half maximum and a separation
  criterion respectively.
- **Module 00's "usable band" was the wavelet's bandwidth**, not the survey's.
  Relabelled, with a note that noise makes the usable band narrower.
- **Three scientific claims hedged**: low Q over gas (widely reported, mechanism
  argued over), blue reflectivity (attributed to well-log studies, varies by
  basin), and the 0.780 tuning ratio (a property of the Ricker's shape, not a
  universal constant).
- **The lowest-strong-lobe convention** is now documented in every module that
  uses it, not just 05 and 08.
- **Module 06's balancing toggle** could be read as an argument against
  balancing; it now says explicitly that this model has one stationary wavelet
  and nothing for balancing to remove.
- **Ambiguity exercises added to modules 04 and 06**, each asking the student to
  find several causes for one observation.
- **Tab strips exceeded the 115-character limit in eight modules** and would have
  wrapped. Step labels shortened; all ten now fit.
- **Landing page** gained the "What else AASPI does" section that module 09
  already referenced, plus prerequisites. **README** gained prerequisites,
  learning outcomes, a time estimate and a maintainer pointer to this file, and
  its module count and vocabulary list were corrected.
- Language trim: "worth", "honest", "quietly", "genuinely" and "simply" reduced
  where they were filler.

## Page-view counting

`assets/count.js` records that a page was opened and nothing else. Every HTML
page needs the one `<script>` line at the foot of the body — a page without it
looks exactly like a page nobody visits. Full procedure in `ADD-COUNTING.md`.

Outstanding: add the office IP under Ignore IPs in the GoatCounter settings, and
fill in the SSRN link, which currently appears as a placeholder in every module
footer, the README and the license.

---

## Final review pass

A full scientific, teaching, language and consistency review was run over the
finished set. What it changed, so that none of it is rediscovered later:

**One real physics error.** `SPEC.applyQ` carried the constant-Q dispersion term
with the sign reversed, which put high frequencies late instead of early. It is
now the exact Kjartansson power law. Nothing in the amplitude spectrum notices a
phase error, which is why it survived every earlier check; `verify-spectral.js`
now launches three narrowband packets through the operator and asserts that the
80 Hz one arrives before the 20 Hz one. Fixing it moved several module 09
readouts, and the prose was resynced to the harness output.

**One consequence worth knowing about.** With the dispersion corrected, the
attenuation shadow (3.2 Hz) is slightly *smaller* than the shadow the processing
location shows (3.6 Hz), because a different wavelet is a different wavelet at
every depth. "Largest shadow" was therefore never a valid discriminator. Step 5
and `harness-09.js` now test what actually separates them: a shadow below
*together with* no change above.

**Terminology decisions, now fixed across the set.**

- *Magnitude* and *amplitude spectrum* are the same quantity. Module 03 step 2
  says so explicitly. The set uses "amplitude spectrum" for the shape of a
  spectrum and "magnitude" for the file or the attribute.
- *Bandwidth* is measured two ways here: half-amplitude in modules 00, 01 and 04,
  half-power for the analysis filter in 03 and 08. Module 03's Method names both
  and says neither is more correct.
- "Constant Q" no longer appears in module 08. Q is a rock property, defined in
  module 09, and using it for a filter bank a module earlier taught students to
  merge two unrelated ideas. Module 08 says "a fixed window length against a
  fixed number of cycles."
- The wavelet's peak frequency slider is labeled **Wavelet peak frequency** in
  every module. It used to be "Wavelet peak" in half of them and "Peak frequency"
  in the rest, and in module 05 that collided with a readout of the same name
  measuring something else.

**Navigation.** The masthead's second slot always means *previous* (module 00 has
none). Every module has a three-way pager, and it now appears on the exercises
tab as well as on Key points and Method — a student who finished the exercises
and stopped previously had no forward link on screen.

**Teaching changes.** Every module's first exercise now opens with a prediction
prompt (`.predict`), and every module has one exercise that asks for several
possible causes of a single observation. Module 03 step 3 is marked optional in
the tab hint and in the pane, since nothing after it uses phase. Module 06 step 2
spells out the thickness → interference → spectral peak → attribute chain instead
of assuming module 04 is still in mind. Module 09 step 2 gives attenuation a
physical cause.

**Conventions to keep.** Every number in prose still has to be printed by that
module's harness — that rule caught the module 09 resync automatically. American
spelling throughout. The pitfalls paragraph in "Why it matters" now has a
different heading in each module; it read as a template when all ten opened
"Where this goes wrong in practice."


## The card illustrations on the landing page

`make-thumbs.js` computes the ten thumbnails from `assets/seismic.js` and
`assets/spectral.js` — the same functions the modules use — and writes them into
`index.html` as inline SVG at `viewBox 0 0 300 96`. Run `node make-thumbs.js`
after any change to the physics and the artwork follows. It is idempotent: it
strips the thumb already in a card before inserting the new one.

There are no image files, so the offline rule and the no-stored-pictures rule
both still hold, and a saved copy of the page still shows its own artwork.

**Insertion splits the file on `<article class="card">` and edits each card in
isolation.** The first version used one regular expression per card across the
whole file; the optional "existing thumb" group matched across a card boundary
and deleted nine of the ten cards — the same failure the geometric attributes
build hit. The script now also refuses to write if the card count or the
card-body count changes.

**Three things only visible by rendering it.** Card 05 was emitting a path of
`NaN`s, because `.map` on a `Float64Array` returns a `Float64Array` and returning
an `[x, y]` pair from it coerces silently. Card 05's key sat on top of the curve
it labeled, so each curve is now labeled at its own right-hand end. Card 04 as
wiggle traces was unreadable at 96 px and is drawn as variable density, the way
the module draws it. Rasterize and look before trusting generated artwork.

**Card 07 is drawn on ink, not on the cream panel.** An RGB blend is black where
all three channels are low, and on a light panel those pixels come back as a
scattered dark rim along the channel edge that reads as an artifact. Its three
frequencies are also chosen so their first lobes cover the thicknesses present:
with a thicker channel the high component sits past the first notch and lights
the thalweg as well as the margins, which is a real effect and one module 07
teaches, but not something to introduce on a thumbnail.

**Size.** `rects()` quantizes colors and merges equal neighbours in both
directions. Without it the time-frequency panels and the blend emit several
thousand one-cell rectangles each and the page passes half a megabyte. It
currently sits at 99 KB with 83 KB of artwork.

---

## The axis orientation bug

Found by printing three modules to PDF and reading the pictures. Every value
axis in the set was labelled upside down.

`SEIS.axisLeft` placed `min` at the TOP unless a caller passed `{ flip: true }`,
and across 56 call sites not one ever did. Meanwhile every curve is drawn with
the ordinary mapping, larger value higher up. So the labels and the data pointed
in opposite directions on every amplitude, thickness, frequency and magnitude
panel in the set. Module 04 step 3 showed a truth line reading "60 ms estimated
at 0 ms true"; module 04 step 5 showed a spectrum peaking next to the label 0.2;
module 00 step 4 showed 60 ms of channel fill at the margins, where there is
none.

**The default is now value-up**, which is what almost every panel needs, and
axes that genuinely increase downward pass `{ down: true }`: seismic time, depth,
and map row indices, which are drawn first-row-at-top. Give `min` and `max` in
increasing order either way. The old `flip` option is accepted and ignored, so a
stale call site cannot silently mean the reverse of what it says.

Fourteen calls are marked `down: true` — seven `'inline'` map axes and seven
`'time (ms)'` axes. The time axes were also written back to front, as
`(NT * DT * 1000, 0)`; they now read `(0, NT * DT * 1000)`.

**Note if you sync `assets/seismic.js` between the sites.** This file's
`axisLeft` no longer matches the copy in the geometric attributes repository.
Carrying this version across means auditing that set's `axisLeft` calls the same
way; carrying that version back here reintroduces the bug.

`verify-axes.js` now guards it. It draws a tick and plots a point for the same
value through a recording canvas stub and requires them to land on the same
pixel row, checks that `{ down: true }` actually inverts, checks that the retired
`flip` is inert, and scans every `axisLeft` call in the modules to confirm that
`'time (ms)'` and `'inline'` axes carry `down: true` and no others do. Run it
alongside `verify-spectral.js`. The harnesses could never have caught this: they
read the stats strip and never look at the picture.

## Two more things the PDFs showed

**`.sublabel b` was styled as a 16 x 16 crimson circle** — a numbered badge, the
job `.stepno` already does. All 54 panel captions in the set hold a phrase, not a
digit, so each was crammed into a circle and rendered as an unreadable crimson
dot. It is now set as what it is: a small bold caption.

**Off-scale estimates were clamped to the frame.** In module 04 step 3 and
module 05 step 1, an estimate outside the plotted range was pinned to the axis
and drawn as though it were exactly 0 or exactly TMAX, giving flat-topped spikes
that touched the frame and looked like data. `onScale()` maps them to NaN
instead, and `series()` already breaks the line at a non-finite value, so an
estimate with no answer now leaves a gap. This matters here specifically because
the noisy notch estimate is *meant* to be seen failing.

---

## Module 07 is an overlay, not an additive blend

The blend used to write each iso-frequency map straight into one display
channel: the additive model, where contributions sum, stacking order is
irrelevant, and a pixel strong in all three comes out white. It is now a
layered co-render, and the module teaches the difference.

`SPEC.overlayPixel` and `SPEC.overlayBlend` composite layers over a background:

    out = out * (1 - a) + color * a,     a = opacity * value

The magnitude drives the opacity, so a layer is clear where its frequency has
nothing and covers what is under it where it is strong. `SPEC.rgbBlend` is kept
for the additive model, and the Method tab names both, says neither is more
correct, and says they do not produce the same image from the same three
volumes — which is why two people in two packages can disagree about a map.

**What the student is meant to take from it.** Two properties an additive blend
does not have. A layer HIDES what is beneath it, so a color can mean "only this
frequency is here" or "the others are covered," and the picture does not say
which. And ORDER MATTERS: reordering gives a different image from identical
data. The module's line is that anything surviving a reordering belongs to the
earth and anything that does not belongs to the display.

**Controls.** Three layer toggles (`lr`, `lg`, `lb`) and a stacking-order
control (`order`: `rgb` = blue on top, `bgr` = red on top), all in the URL state
so a configuration can be shared. The last layer standing refuses to switch off,
because turning all three off leaves a blank frame with no way back short of
reloading.

Step 1 now builds the stack up one layer at a time in painting order — bottom
layer alone, then each added over what is there, then the finished blend —
instead of showing the three maps side by side, which never made it clear they
were stacked.

The card on the landing page calls `SPEC.overlayPixel` too, so it cannot show a
display model the module contradicts.

`verify-spectral.js` checks the properties rather than the pixels: an opaque top
layer hides the one below, swapping the order changes the pixel, a
zero-magnitude layer is invisible, a partly transparent one mixes rather than
replaces, a switched-off layer contributes nothing, the whole-map form agrees
with the single-pixel form, and — as the contrast — the additive model has no
order to depend on.

The coverage arithmetic did not change, so every readout in module 07 is the
same as before; the harness passed unmodified through the whole change.


### Corrections to the overlay work, from reading a printed module 07

**Step 1 showed the stack accumulating, and it read wrong.** The panels were
"18 Hz", "+ 30 Hz", "+ 46 Hz", "the blend" — each adding the next layer over the
last. A reader takes the second panel to be the 30 Hz map and sees red in it,
which is exactly the wrong lesson. The third panel was also identical to the
fourth, since both held all three layers.

Step 1 now shows the three maps **alone**, each in its own layer color, and then
the three stacked. The occlusion is still visible, and more clearly: the 18 Hz
map is bright down the channel axis on its own and that axis is blue in the
stack. The interactive build-up lives where it belongs, on the header toggles.

**Layer opacity is a control, defaulting to 70%.** At 100% the top layer covers
everything under it wherever it has any strength, and on this channel the 46 Hz
component has a comb sidelobe over the thick fill, so blue obliterated red
entirely and the stack became a picture of one frequency. That is a true
property of the model and the module says so, but it makes a poor default. The
slider lets a student drive it to 100% and watch the lower layers disappear,
which is the mechanism made visible. Solo panels are always drawn opaque, since
each is a map rather than a layer in a stack.

**Module 00 step 5 also draws a blend**, and it was still additive after module
07 changed. Two modules showing the same channel under the same name have to
show the same picture, so `why.html` now calls `SPEC.overlayPixel` with the same
colors, the same ink and the same 0.7 opacity, and its prose points forward to
module 07 rather than describing a different model. The landing-page card
matches too. If the compositing changes again, all three places change together
— they are the whole list.

## September 2026: the rewrite pass

`docs/REWRITE-BRIEF.md` is the working document for this. It records the
pattern, the measurements behind it, and the faults found on the way. What has
changed at repository level:

**Licensing and attribution.** CC BY-SA 4.0, replacing the earlier
free-for-teaching terms, in `LICENSE.md`, every module footer and `index.html`.
Credited to Dr. Heather Bedle and Dr. April Moreno-Ward.

**Pop-out.** `assets/popout.js` is loaded by all ten modules and puts the
exercises in a second window. See `docs/ADD-POPOUT.md`; no markup change needed.

**One canonical name per module.** The module's own `<h1>` is the name. The
index card and the README table are set from it, and the next-up cards and pager
links carry the same string. Before this, seven of the ten modules were named
three different ways and a student clicking a card landed on a page with a
different title. If you retitle a module, change the `<h1>` and propagate.

**Every step has live controls.** Seven step panes had none: the pinned header
was hidden for that tab and the pane carried no slider. The header is now shown
on all five steps in every module. Check the `lab.hidden` line before adding a
pane.

**Seismic sections.** Modules 04, 05 and 09 now draw one. The models always
contained the traces; they were being reduced to curves before anything reached
the screen. `SEIS.drawSectionPanel()` and `STRATA.buildSection()` do the work.

### The clipped axis label

`SEIS.axisLeft` placed its rotated label at a hardcoded `rect.x - 42`, but every
module sets its own `M.l`. Where that margin was 52 or less the label was drawn
past the left edge of the canvas and only a narrow vertical sliver of each glyph
survived, which reads on screen as a column of dots. It affected `why`,
`attributes`, `blending` and `methods` here, and affects the companion
repositories still. The label is now placed from the measured width of the
widest tick label and clamped so its glyph body cannot leave the canvas.

**The harnesses could not have caught this,** and neither could any of the
structural checks: every readout was correct and only the picture was wrong. The
same is true of the missing profile-position line in module 00 step 4 and of the
unreadable RGB blend in step 5. Render the page and look at it.

### Readouts that run backwards

Two readouts added in this pass reported the opposite of the truth, and both
looked reasonable in the source:

- Module 04's traceability figure compared a peak amplitude in the target window
  against the mean amplitude away from it, both on the noisy section. Noise
  raises both, and one noise spike inside the window satisfies the test, so a
  buried bed read as *more* traceable than a clean one. Fixed by building the
  section twice with the same seed, once without noise: the difference is the
  noise and the clean build is the signal.
- Module 09's shadow confidence divided by a trace-to-trace scatter that was
  exactly zero, because every off-body trace was identical, and reported
  `Infinity`. Perturbing bed strengths did not fix it — peak frequency is set by
  bed spacing, not amplitude — so the bed times had to jitter too.

Both harnesses now assert the direction of the effect rather than only printing
it. Any readout of this kind needs that: `harness-04` checks that noise never
improves traceability, `harness-09` fails on `Infinity`.

## Filling in the SSRN link

The citation appears in thirteen places: ten module footers, `index.html`,
`README.md` and `LICENSE.md`. Editing them by hand is how three of them ended up
in three different formats.

```
node set-ssrn.js --check                    # where the placeholder still is
node set-ssrn.js https://papers.ssrn.com/...   # fill it everywhere
```

Running it twice is harmless, and running it with a new link updates a previous
one. Follow it with the tag-balance check, since it edits markup.

All three citation blocks now carry the same form, which is the one the module
footers already used:

> Bedle, H., and A. Moreno-Ward, 2026, *How Spectral Attributes Actually Work:
> A Set of Browser-Based Interactive Modules*: SSRN working paper, University of
> Oklahoma.

Heather Bedle's ORCID, 0000-0003-3010-0195, is in `README.md` and `LICENSE.md`.
April Moreno-Ward's is not — add it when known.

## Maps drawn far smaller than their panels

Every map panel is aspect-locked to its grid, and every caller passed a fixed
canvas height. `mapBox` then fitted the map inside that height, so the drawn map
was the same width whatever the panel width was: 166 px of map in a 560 px panel
in module 00, 278 px in modules 06 and 07. On a wide screen a map sat in the
middle of a large empty box.

Each of those modules now has a `mapHeight(w, maxH)` that computes the canvas
height from the width, so the map fills the panel, with `maxH` only there to
stop a very wide panel producing an absurdly tall canvas.

| | was | now |
| --- | --- | --- |
| 00 header map | 271 px | 364 px |
| 00 one of three channel maps | 166 px | 317 px |
| 00 blend / truth pair | 271 px | 457 px |
| 06 main map | 278 px | 434 px |
| 07 three-across | 170 px | 314 px |
| 07 main | 278 px | 434 px |

**The caps must be raised when converting a caller.** Passing the old fixed
height straight through as `maxH` changes nothing, because that height was what
was binding. The first attempt at this did exactly that and every map came out
the same size.

## The landing page hero

`make-hero.js` builds it: the RGB blend, with the three components that make it
alongside, computed from `assets/seismic.js` in the same way the card thumbnails
are. The hero was previously a copy of the module 00 card thumbnail, so a reader
met the same small grey picture twice within one screen.

Watch the file size. A rect per grid cell came to 7,835 rects and 568 KB of SVG,
which is a download rather than a hero image. Three changes brought it to 1,219
rects and 81 KB with no visible difference: quantise each colour channel to
seven levels, merge runs of identical colour the way `make-thumbs.js` does, and
write colours as hex rather than `rgb(r,g,b)`. The three single-hue panels are
also drawn from a grid decimated by two, since they are small on screen.

## The card buttons

Each card carried a red `Open module NN` button under a title that was already a
link to the same page: two things to aim at, one of them shouting. Removed. The
title remains the link.
