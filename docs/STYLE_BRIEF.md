# House style and design brief
### For building a new set of interactive teaching modules in the same style as *How Geometric Attributes Actually Work*

Upload this file at the start of the new conversation. It carries the audience,
the motivation, the visual identity, the module template, and the working
practices — including the mistakes worth not repeating.

Companion files worth uploading alongside it:
- `assets/style.css` — the entire visual identity, reusable as-is
- `assets/seismic.js` and `assets/attributes.js` — the physics and drawing library
- any one finished module (`modules/curvature.html` is the most complete) as a
  structural template
- the SSRN working paper, for the framing and voice

---

## 1. Who this is for

**Heather Bedle**, School of Geosciences, University of Oklahoma, running the
AASPI consortium. The modules are built for her own students and for a wider
audience, and are framed as education rather than promotion of AASPI.

**The audience is the interpreter who was never taught the machinery.**
Undergraduates meeting the topic for the first time; graduate students in
geology, structural geology or sedimentology whose research depends on tools
they did not build; and professionals who arrived in an interpretation role from
an adjacent discipline and are expected to be productive in weeks.

They are not missing the rules. They generally know the conclusions. What they
have never done is *watch the thing happen* — and a rule that has been read is
applied where it is remembered and forgotten everywhere else, while a limit that
has been watched arising is available in situations the rule never named.

**The gap being filled is practical, not conceptual.** The underlying models are
small and run fine in a browser. What has been missing is somewhere to
manipulate them: an interpretation package can compute but not open up; a
notebook can open up but needs an installation and a language. Neither is a
reasonable ask for a two-hour undergraduate session.

## 2. The five design principles

These are load-bearing. Each was applied against a real temptation.

1. **Compute, don't illustrate.** Every panel is generated from the parameters on
   screen. No stored images, no schematics, no curves drawn to look plausible.
   This is a strong constraint because it means the tool *can be wrong* — and it
   repeatedly was. That is the point: a drawing cannot disagree with theory.
2. **State what is left out, and where it departs from production software.**
   Every module carries a Method section listing simplifications and naming
   where the implementation differs from the real algorithm. This is teaching
   content, not a disclaimer.
3. **Open on the problem, not the solution.** Defaults should show the difficulty
   before the fix. Check that the effect under discussion is visible on arrival.
4. **Structure interaction toward a question.** Sliders alone produce aimless
   clicking. Every module ends with numbered exercises stating what to change,
   what to watch, and what to conclude — with answers behind a *Hint* toggle.
5. **Nothing leaves the machine.** Static HTML, CSS, JS. No server, no account.
   Nothing that happens inside a module is transmitted. A single shared
   `count.js` records that a page was opened — no cookie, no identifier, no
   event tracking — and the site says so plainly in its About section and in
   every module footer. Runs offline from a local copy. State encoded in the
   URL so an instructor can distribute an exact configuration as a link.

## 3. Voice

Direct technical prose in a professor's voice, with enthusiasm where it is
earned. Short sentences. No LLM throat-clearing, no "delve", no "it's important
to note", no rhetorical questions used as transitions.

- Say the counterintuitive thing plainly and then prove it with a number.
- Name the trap before the reader falls into it.
- Where a source contradicts itself, say so rather than quietly choosing.
- Never claim more than the picture shows. If a measurement contradicts the
  teaching text, change the text.
- **American spelling throughout**: color, center, normalized, gray, meters,
  behavior, license.

## 4. Module template

Every module is a **single self-contained HTML file** with its own markup and
script, linking only to the two shared JS files and the stylesheet. A module can
be copied, emailed or opened from disk and still work, and editing one cannot
break another. Each also carries local fallbacks for shared functions it needs,
so it survives a stale `assets/` on the server.

**Page structure, in order:**

```
masthead ......... brand, nav
mod-head ......... eyebrow (module number), h1, sub (the hook)
labhead .......... STICKY: live panel + the controls that drive it
tabhint .......... one line of instruction
tabs ............. 1..N steps | Why it matters | Exercises | Key points | Method
tabpanes ......... one per tab, only the visible one is drawn
nextup / pager ... shown on the last reference tabs only
footer ........... credit, licence, citation
```

**The header is pinned deliberately.** An early version put controls above a long
scrolling page; a reader on step five could not see the sliders and the panel at
once, which defeats the whole purpose.

**Tab count:** aim for 5 steps plus 4 reference tabs. Keep total tab-label length
under ~115 characters or the strip wraps.

**Every step pane** gets a `plot-head` with a numbered badge, a short hint on the
right, `.lede` prose, the canvas or canvas row, then a `stats` strip of readouts,
then optionally a `legend prose` block for a caveat.

**Exercises**: 5 of them, each `<li><b>Imperative instruction.</b> what to do
<details class="reveal"><summary>Hint</summary><span class="ans">…</span></details></li>`

**Why it matters**: what it is used for in real work (bulleted), then how it
misleads (prose), then a closing caveat in a `legend prose`.

**Key points**: 6 bullets, each opening with a bolded claim.

**Method**: how it is computed, where it departs from production software and
why, simplifications, then references.

## 5. Visual identity

Reuse `assets/style.css` unchanged. Crimson `#841617`, teal `#0B7285`, ink
`#16191C`, slate `#5C6670`, cream panel. Archivo display, IBM Plex Sans body,
IBM Plex Mono for labels and numbers.

**Drawing rules learned the hard way:**

- **Color bar on every attribute map**, always. A reader should never have to
  guess whether blue is high or low.
- **Square plot boxes for square grids.** A grid with equal bin spacing must be
  drawn into a square box or every shape and azimuth read off it is wrong.
- **Cyclic quantities get cyclic scales**, and the wrapping differs: an azimuth
  is a direction and wraps at 360°, a strike is an orientation and wraps at 180°.
- **Fixed axes on anything a slider drives.** A rescaling axis hides the change.
- **Depth reads negative and increases downward**, on a datum.
- **Canvas width from the parent's content box**, not `clientWidth` — a tab pane
  has 26 px of padding, so a full-width canvas overruns by 52 px.
- `SEIS.tag(ctx,x,y,text,color)` fills the box with `color` and writes **white**
  text into it. Never pass white.
- Check label collisions arithmetically rather than by eye.

## 6. Working practice

**Measure, don't estimate.** Every number that appears in the prose or an
exercise must be read out of the running page. Build a headless harness
(`jsdom` + a stubbed canvas) that opens the module, drives every control, and
prints the readouts. Use it as both regression test and measurement instrument.

**Verify against theory where a closed form exists.** Curvature was checked
against a sphere, a cylinder, a saddle and — the decisive one — a tilted plane
that must return exactly zero. Those checks found real errors.

**When a measurement contradicts the teaching text, the text is wrong.** This
happened twice in the geometric attributes set and both corrections improved the
module.

**Errors that are invisible without a check** — these all occurred:
- a sign convention that put positive curvature on synclines
- edge artifacts from a clamped stencil dominating every statistic
- an aspect-ratio distortion stretching maps by 1.83×
- three noise sliders that moved the output by a few percent and appeared to work
- a statistic sampling a fixed column after the feature was given a dip
- a regex edit that spanned card boundaries and deleted seven of eight cards
- debounced recomputation making a test read the value before the update

**Structural checks to run after every edit:** JS syntax (`node --check`), tag
balance, `$('id')` references against ids present, and the headless render.

## 7. What to decide first for the new set

1. **The topic and its through-line.** Geometric attributes had one: everything
   is a derivative of dip and inherits its errors. A set without a spine reads as
   a catalogue, which is the thing being replaced.
2. **The module sequence**, ordered so each depends only on those before it, with
   the question each answers written out before any building starts.
3. **What already exists in `assets/`** that can be reused, and what physics needs
   adding.
4. **The first module.** Build one all the way to finished — including exercises,
   Why it matters, and verification — before starting the second. The template
   settles far faster that way.

---

*Companion to* How Geometric Attributes Actually Work,
https://hbedle-subsurface.github.io/geometric-attributes/
