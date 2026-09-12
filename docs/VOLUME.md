# The synthetic volume — `assets/volume.js`

A 3D survey generated from a seed at load time. Nothing is stored, so the
model can be pushed until it breaks, and every measurement made on it can be
checked against a truth map. Run `node verify-volume.js` for the numbers.

Shared across the module sets. It depends only on `assets/seismic.js` and
uses `strata.js` if that is loaded, so it can be dropped into the geometric
attributes, single-trace and inversion repositories unchanged.

---

## What is in the model

From the top down:

| Feature | Level | What it is for |
| --- | --- | --- |
| Background bedding | throughout | The section the targets have to stand out from |
| Marker limestone | 0.60 s | The reference horizon for flattening |
| Reservoir sand | 0.78 s | Bright spot, flat spot, and the shadow beneath |
| Channel system | 0.95 s | Two incision stages, the younger cutting the older. Flat top, erosional base |
| Sheet sand | 1.20 s | A tuning wedge in map view as well as in section |
| Coal | 1.42 s | A thin, very strong reflector |
| Normal fault | below 0.60 s | Lateral discontinuity |

Structure is a regional dip plus a four-way anticline. The gas-water contact
is flat in time and is placed from the shallowest top-reservoir in the survey,
so the gas sits in the closure and the largest column is exactly `gasColumn`.
It occupies 15.5% of the survey area at the defaults.

Every reflection coefficient is computed from impedance, including the
bedding, which is a set of small impedance perturbations of the host shale.

## Rocks

The lithology table is the resolution set's, by way of `strata.js`. One rock
is added here, and the reason is worth keeping in view: that set's **Sand** is
a tight sand whose impedance is within half a per cent of shale, giving a
reflection coefficient of −0.0035, weaker than the bedding around it. A
channel filled with it is genuinely invisible. So the default channel fill is
a new **porousSand** (2350 m/s, 2.20 g/cc, RC −0.104), and the tight case
stays available through `channelRock: 'sand'`.

The harness measures both, on a window spanning the fill. With the porous
fill the channel stands 4.0 times above the background bedding. With the tight
fill it reads 1.00 — indistinguishable, at any thickness. That agrees with
module 04, which already tells students a sand in shale sits at 0.36 of
bedding strength and is not separable on a section.

So the fill is what makes a channel visible here, not the incision. An
erosional surface that truncates strong bedding against a contrasting fill
would show; one that truncates it against sand of the same impedance does
not.

## Attenuation

One mechanism, two effects. Each reflection carries `t*`, the integral of
`dt/Q` down its own two-way path, and the wavelet is drawn from a bank built
across the range of `t*` in the model. So the section loses high frequencies
with depth on every trace, and loses them faster beneath the gas column.

Measured on a bedding-only volume, the spectral centroid falls from 31.2 Hz at
0.50 s to 26.3 Hz at 1.65 s. Switch `attenuation: false` and that trend goes
(34.0 to 32.5 Hz). Beneath the gas the peak frequency at 1.30 s reads 21.5 Hz
against 26.0 Hz off it: a 4.5 Hz shadow, measured rather than asserted.

Constant-Q dispersion is included, so the high frequencies arrive slightly
early. It is small at these Q and is there for correctness.

## Cost

| Size | Build | Memory |
| --- | --- | --- |
| 96 × 96 × 360 (default) | 0.9 s | 12.7 MB |
| 128 × 128 × 400 | 1.6 s | 26 MB |

Build once on page load, then slice interactively — every accessor below is
fast. Do not rebuild on a slider; put the wavelet, noise and target sliders on
controls that trigger a rebuild deliberately, and the slice, horizon and
frequency sliders on ones that do not.

## API

```js
const vol = VOL.build({ f: 30, noise: 4 });
```

Returns `{ nx, ny, nt, dt, t0, dx, dy, data, wav, horizons, truth, rc, ... }`
with `data` laid out as `[(ix*ny + iy)*nt + it]`.

**Truth maps**, all `Float32Array(nx*ny)`, thicknesses in seconds:
`truth.channel`, `truth.channel1`, `truth.channel2`, `truth.wedge`,
`truth.gas`, `truth.tstarRes`, `truth.tstarDeep`.

**Horizons**, two-way time per bin: `horizons.marker`, `.reservoir`, `.gwc`,
`.channel`, `.wedge`, `.coal`.

**Accessors**

| Call | Gives |
| --- | --- |
| `VOL.trace(vol, ix, iy)` | one trace, as a view |
| `VOL.inline(vol, ix)` / `VOL.crossline(vol, iy)` | a section |
| `VOL.timeSlice(vol, t)` | constant time, cutting across structure |
| `VOL.horizonSlice(vol, h, offset, mode, window)` | `value`, `peak` or `rms` on a surface |
| `VOL.flatten(vol, h, tRef)` | every trace shifted so `h` lies flat |
| `VOL.stratalSlab(vol, top, base, n)` | `n` proportionally spaced surfaces |
| `VOL.windowOn(vol, h, offset, length)` | the sub-volume a decomposition runs on |
| `VOL.thicknessInMetres(ms, rockKey)` | ms into metres at the bed's own velocity |

`flatten`, `stratalSlab` and `windowOn` exist because the extraction geometry
is the step every Method section currently declares out of scope. A flat model
needs no flattening, which is why the module set has never had to show it.

Use `peak` extraction with care: it flips sign trace to trace and produces a
speckled map. `rms` over a window that spans the bed is the safer default.

## Options

Everything in `VOL.DEFAULTS` can be overridden. The ones that change what is
being taught rather than the size of it:

- `background`, `structure`, `fault`, `channels`, `secondChannel`, `wedge`,
  `gas`, `attenuation`, `dispersion` — each switchable, so a module can show
  one effect at a time and then all of them together.
- `channelRock`, `wedgeRock` — `porousSand` by default, `sand` for the
  invisible case, `gasSand` for a bright one.
- `f`, `wavelet`, `noise`, `bedStrength` — the acquisition.
- `channelFill`, `wedgeMax`, `gasColumn`, `crest`, `dip`, `faultThrow` — the
  geology.

## What it does not do

No multiples, no mode conversion, no anisotropy, no transmission loss other
than absorption, no migration artifacts, no acquisition footprint, no lateral
velocity variation and therefore no velocity pull-up beneath the gas. The
channel fill has one uniform impedance, so every point in it is a clean
two-reflector bed; real fill is layered, and that layering is most of what
puts structure in a real spectrum. Reflections are convolutional, so there is
no Fresnel zone and lateral resolution is unlimited.

Each of those is a candidate for a later version. None should be described in
a module as though it were present.
