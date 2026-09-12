# How Spectral Attributes Actually Work

Browser-based experiments in seismic frequency, built for teaching. Free to use,
nothing to install, and everything on the screen is computed live while you
change it.

**[Open the modules →](https://hbedle-subsurface.github.io/spectral-attributes/)**

Dr. Heather Bedle ([ORCID 0000-0003-3010-0195](https://orcid.org/0000-0003-3010-0195),
hbedle@ou.edu) and Dr. April Moreno-Ward
([ORCID 0009-0007-8826-8827](https://orcid.org/0009-0007-8826-8827),
april.morenoward-1@ou.edu), University of Oklahoma, with the
[AASPI](https://www.ou.edu/mcee/labs/aaspi) consortium.

---

## Why this exists

A seismic image is weighted toward one bed thickness, the thickness that happens
to suit the wavelet, so the parts of a channel or a sand body that are thicker or
thinner than that come back quieter. Change the frequency and a different part of
the same body appears.

Most people meet this as a fact to accept: run spectral decomposition, look at
the blend, the channel shows up better. Stated that way it is easy to repeat and
easy to misread. It is harder to misread having watched one channel light up
along its axis at 15 Hz and along both margins at 60 Hz, with nothing about the
model changed in between, and having seen the dark gap that a high-frequency map
puts exactly where the sand is thickest.

Each module is built around one experiment. Move a slider and watch the thing
happen.

## Who it is for

Beginners, in three groups:

- **Undergraduates** meeting frequency for the first time, who need to see the
  effect before they meet the transform.
- **Graduate students** in geology whose research depends on attribute volumes
  they did not compute.
- **People who arrived in an interpretation role from an adjacent discipline**
  and are expected to be productive in weeks.

The goal is foundational understanding and correct vocabulary rather than
coverage. Someone who finishes the set should be able to hold a conversation
about spectral decomposition without bluffing, and should recognize the terms
they will meet in their first month on a workstation.

**What you need first.** An introductory geophysics course, or the equivalent:
that reflections come from contrasts in acoustic impedance, that a trace is
reflectivity convolved with a wavelet, and that seismic times are two-way.
Module 00 restates all three, so you can start without them. No mathematics
beyond a sine wave, and nothing to calculate by hand.

## The modules

In the order they build on each other.

| # | Module | The question it answers |
|---|--------|-------------------------|
| 00 | [One channel, imaged four different ways](modules/why.html) | Why would a geologist care which frequency they look at? |
| 01 | [What a seismic wavelet is made of](modules/spectrum.html) | A report says the data are 30 Hz. What is that number measuring? |
| 02 | [Putting a window on the trace](modules/windows.html) | Where in the trace did that frequency come from? |
| 03 | [What actually comes out of a spectral decomposition](modules/components.html) | I have a volume called `spec_mag_20`. What am I looking at? |
| 04 | [Tuning, and what a thin bed does to amplitude](modules/tuning.html) | Why does a bed vanish at one frequency and shout at another? |
| 05 | [Is that a map of the geology, or of the source wavelet?](modules/balancing.html) | Is that map showing me the geology, or the source wavelet? |
| 06 | [Peak frequency, peak magnitude, and the maps they make](modules/attributes.html) | How does a spectrum everywhere become one picture? |
| 07 | [The colored channel image, taken apart](modules/blending.html) | What do the colors in that image actually mean? |
| 08 | [One trace, four answers](modules/methods.html) | The menu has three programs. Which one, and why? |
| 09 | [Three ways to make a low-frequency anomaly, and one to miss a reservoir](modules/shadows.html) | I found a spectral anomaly. What else could it be? |

Two orderings are deliberate. **04 comes before 05** because tuning has to be
learned on clean synthetic data before module 05 shows that real data ruin it
until the wavelet is dealt with. **05 comes before 06** because peak frequency
only estimates a thickness on balanced data, and every claim in 06 rests on
that.

## Using these in a class

**Hand out a link.** Every slider and toggle is written into the address bar as
it moves, so the URL always holds the current configuration. Copy it and
everyone starts on an identical setup, which makes these straightforward to
assign as problem sets.

**Every module ends with five to seven exercises**, each saying what to change, what to
watch, and why it is worth noticing — with the answer behind a *Hint* toggle.
They can be assigned directly as homework. An **Open in new window** button puts
the exercises in a second window so a student can read them while working the
controls in the first, and printing that window expands the hints, so an
instructor can print the exercise sheet with the answers. The interactive panel
at the top of each module has its own **Open controls in a window** button, so
the model and the text can sit side by side on one screen.

**Two hours only?** Modules 00, 02, 04 and 06 make a coherent short course: why
frequency matters, the resolution trade that limits every method, tuning and the
thin bed, and how a spectrum everywhere becomes a map. Add 09 if the emphasis is
interpretation rather than method.

Each module takes roughly twenty to forty minutes including the exercises.

## Two numbers worth knowing

A frequency *f* responds most strongly to a bed **1/(2f)** thick in two-way
time. That relation is exact for a clean two-reflector bed, and module 04
derives it.

It is not the same number as the amplitude tuning thickness of a particular
wavelet, which for a 30 Hz Ricker measures 13.0 ms against the 16.7 ms that 1/(2f)
gives. Beginners routinely merge the two. Module 04 measures both and names the
difference, and the [seismic resolution
modules](https://hbedle-subsurface.github.io/seismic_resolution/) approach the
same limit from the other side.

## What this is not

These are teaching models. Every panel is computed from a small synthetic on the
screen, and every module has a **Method** tab listing what it leaves out and
where it departs from a production algorithm. Module 09 says plainly that it
teaches interpretation caution rather than an algorithm, because no *Q*
estimation program exists in the documentation this set was built against.

For work on real volumes use [AASPI](https://www.ou.edu/mcee/labs/aaspi) or your
interpretation package. The numbers here describe the model on the screen, not
your survey.

Several real programs are deliberately left out — spectral slope and roughness,
phase residues, bandwidth extension, `thin_bed_decomposition`,
`spectral_probe`, `spec_vmd`, `kxky_cwt`. Each is useful, and each needs
vocabulary this set does not build. The landing page names them so an advanced
reader has a thread to pull.

## Privacy

Nothing you do inside a module leaves your browser. No slider setting, no click,
no computed trace is transmitted anywhere. The stylesheet, the three typefaces
and every line of module code are served from this repository, so opening a page
contacts no other domain.

The one exception is an anonymous page count, with no cookie and no identifier,
so that the modules people actually use are the ones that get improved. See
`assets/count.js`, which explains exactly what is sent and how to switch it off.

## License and citation

Licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Free
to use, adapt and share, including in teaching and including commercially,
provided the source is credited and any adaptation is released under the same
license. If you use it in a course or a talk, a credit line and a link back are
all that is asked. The full terms are in `LICENSE.md` at the repository root.

> Bedle, H., and A. Moreno-Ward, 2026, *How Spectral Attributes Actually Work:
> Ten Interactive Browser-Based Modules for Learning Spectral Decomposition,
> Tuning, Spectral Balancing, and RGB Blending*: SSRN working paper, University
> of Oklahoma. SSRN: *[article link to follow]*
>
> https://hbedle-subsurface.github.io/spectral-attributes/
