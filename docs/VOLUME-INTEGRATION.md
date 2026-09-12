# Integrating the volume — status

All ten harnesses run clean and `verify-volume.js` passes 32 of 32.

## The rule used

Existing models were not replaced. Every module's numbers are asserted in its
harness and quoted in its prose, so swapping a model out invalidates both. The
volume is added where it shows something the current model cannot; everything
else is additive.

## Done

**Module 00, step 4 — a seismic section across the channel.** Above the
existing profile curves. Two-way time down the left, depth in metres down the
right, and the true top and erosional base of the fill drawn on it. Two
readouts convert the fill at the axis twice, at the step 1 velocity and at the
velocity of the sand itself: 25.2 ms reads 31 m at 2500 m/s and 30 m at
2350 m/s. Built small and cached — 71 ms cold, free after. The volume's
channel is calibrated to the module's own: 25.2 ms of fill at the axis against
the module's 25.4 ms.

**Module 01, step 1 — the wavelet that comes back from depth.** Resolution
against depth was the one claim in module 01 that could not be seen from a
panel. The same source wavelet is now propagated to 0.5, 1.0, 2.0 and 3.0 s
through rock of a chosen Q, using the same constant-Q operator the volume
uses, with the thinnest resolvable bed reported in milliseconds and metres.

| Q | peak at 0.5 s | at 3.0 s | thinnest bed |
| --- | --- | --- | --- |
| 30 | 19.5 Hz | 6.3 Hz | 32 m → 98 m |
| 80 | 27.3 Hz | 13.7 Hz | 23 m → 46 m |
| 200 | 27.3 Hz | 21.5 Hz | 23 m → 29 m |

**Module 04, step 4 — the quarter wavelength.** The set gave the tuning
thickness as 1/(2f) throughout and never used the word wavelength, while every
introductory course gives it as λ/4 and the book chapter does too. A student
had two sources, two formulas and no bridge. Both tuning thicknesses are now
also reported as fractions of a wavelength, and the paragraph derives the
identity: a quarter wavelength is v/(4f) in the ground, the two-way delay is
2 × v/(4f) ÷ v = 1/(2f), and the velocity cancels — which is why the seismic
version carries no velocity and the textbook version does. Spectral tuning
reads λ/4.0 at 15, 30, 45 and 60 Hz; amplitude tuning reads λ/5.1. A glossary
entry was added.

**Module 08, step 5.** Prose corrected from 25 / 24 / 27% to 25 / 35 / 37%,
which is what the harness measures and what the module's own exercise already
said.

## Next, in order

**1. A new module on the extraction.** Still the biggest gap. Every Method
section says the extraction geometry usually decides whether the result is any
good, then says the interval here is known because the model made it.
`flatten`, `stratalSlab`, `windowOn` and `timeSlice` exist for it. Four
panels of one interval — time slice, horizon slice, flattened slab,
proportional stratal slice — with the truth map beside them. On a structured
volume the four disagree, and the disagreement is the lesson.

This one needs a decision before it can be built: it is an eleventh module,
and it belongs before module 06 rather than after 09. Either it goes at the
end and is signposted, or the set renumbers.

**2. Module 09, step 3.** Its Method section says the four locations are
separate traces rather than a lateral model, and that a real line would not be
built that way. The volume has a real four-way closure with a measured shadow
(21.5 Hz beneath against 26.0 Hz off it). Left alone for now because that step
carries carefully tuned reasoning about trace-to-trace scatter, and every
number in its prose would need re-measuring and rewriting.

**3. Module 06, step 3.** The gating argument runs on a flat model where the
window is exact everywhere. On the volume the window has to be placed, and a
badly placed one produces low-magnitude areas that gating then removes — a
second and more common reason most of a map should not be interpreted.

**4. Metres in modules 02 to 09.** Modules 00 and 01 convert to metres
constantly; from 02 onward the set is entirely in milliseconds. Now that
`thicknessInMetres` takes the bed's own velocity, a second readout is cheap
wherever a thickness is quoted.

**5. Detection versus resolution.** Kallweit and Wood's distinction is the
justification for the whole method for a geologist, and the book chapter makes
it a centrepiece. The set has the idea spread across modules 04 and 06 but
never names the pair.

## Two corrections made along the way

**The incision was upside down.** The channel fill built upward from a flat
floor, which is a mound. An incised channel has a flat top and a curved
erosional base. Fixed; `horizons.channel` is now the top of the fill.

**A claim from the first build does not survive that fix.** On the inverted
geometry a tight-sand channel appeared to show as a quiet zone where bedding
had been cut out. With the correct geometry it reads 1.00 against background —
indistinguishable at any thickness, which agrees with what module 04 already
tells students about sand in shale. The fill is what makes a channel visible
in this model, not the incision. The earlier result should not be used.
