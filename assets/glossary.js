/* ===========================================================================
   glossary.js — click a term in the prose and read what it means
   Heather Bedle and April Moreno-Ward / AASPI / University of Oklahoma

   The same file is used unchanged by every teaching repository that carries
   the matching term list below.

   Why this exists: a reader coming from geology meets thirty new words in ten
   modules, and each one is defined once, in the module that introduces it.
   A term met again four modules later is a term the reader has to go looking
   for. Here every term carries its definition with it: the word is a button,
   and pressing it opens the definition where the word is.

   Each entry is written in two parts, in this order:

     what   — what the quantity is, arithmetically or physically. No geology.
     earth  — what that quantity commonly corresponds to in the subsurface,
              and what it does not. This is the part a reader trained in
              geology rather than signal processing is usually missing.

   Keeping them apart is deliberate. The arithmetic is always true. The
   geological association is a common case with exceptions, and the two are
   different kinds of statement.

   WHAT IT DOES: marks terms in text that is already on the page, and shows
   text held in this file. Nothing is fetched, sent or stored. It works from a
   file:// copy with no network.

   HOW TO INSTALL: one script tag per module. No markup change and no
   stylesheet change. If this file is missing the prose reads exactly as it
   always did.

   License: CC BY-SA 4.0. Free to use, adapt and share with credit; any
   adaptation must be released under the same license.
   =========================================================================== */

(function () {
  'use strict';

  /* =====================================================================
     THE TERMS

     `aka` holds spellings and abbreviations that should open the same
     entry. `mod` is the module that introduces the term; the link is built
     from it at run time so this file does not have to know where it is
     being loaded from.
     ===================================================================== */

  var TERMS = {
    'acoustic impedance': {
      mod: 'why', title: 'Module 00',
      what: 'The density of a rock multiplied by the velocity of sound in it. It is a property of one rock, not of a boundary.',
      earth: 'Two rocks reflect sound at their contact only where their impedances differ. Sand and shale usually differ in both density and velocity, which is why a sand body encased in shale has a top and a base that both reflect. A sand and a shale can also happen to have the same impedance, in which case the contact between them returns nothing at all.'
    },
    'reflection coefficient': {
      aka: ['reflection coefficients'], mod: 'why', title: 'Module 00',
      what: 'The fraction of the arriving amplitude that a boundary sends back, equal to the difference in acoustic impedance across the boundary divided by their sum. Its sign follows the sign of that difference.',
      earth: 'A value of 0.1 is a strong but ordinary sand-in-shale contrast. The top and the base of one bed have coefficients of opposite sign, so the two reflections they produce are opposite in polarity, and what the trace records is their sum.'
    },
    'two-way time': {
      aka: ['two way time', 'TWT'], mod: 'why', title: 'Module 00',
      what: 'The time for a wave to travel from the surface down to a boundary and back. Seismic sections are plotted against it because it is what the recording measures.',
      earth: 'A bed 30 m thick in rock of 2500 m/s occupies 24 ms of two-way time, not 12 ms. Converting between the two requires a velocity, which is a separate measurement and is rarely known to better than a few per cent. Two thicknesses quoted in meters can therefore disagree while the times they came from agree exactly.'
    },
    'thalweg': {
      mod: 'why', title: 'Module 00',
      what: 'The line of deepest incision along a channel.',
      earth: 'In a channel filled after incision the thalweg usually carries the thickest fill, and the fill thins toward both margins and commonly downstream. A channel is therefore a thickness map in its own right, which is what makes it a useful subject for a discussion about thickness.'
    },
    'wavelet': {
      aka: ['wavelets'], mod: 'spectrum', title: 'Module 01',
      what: 'The waveform returned by a single reflecting boundary. It has a finite length in time and contains a range of frequencies rather than one.',
      earth: 'Nothing in the earth is shaped like a wavelet. It is the imprint of the source, the recording system and the processing, laid on top of every reflection in the section. Two beds closer together than the length of the wavelet return waveforms that overlap, and the overlap is what limits how thin a bed can be recognized.'
    },
    'amplitude spectrum': {
      aka: ['amplitude spectra'], mod: 'spectrum', title: 'Module 01',
      what: 'The amount of each frequency present in a waveform, plotted against frequency. Together with the phase spectrum it holds the same information as the waveform itself, and either can be computed from the other without loss.',
      earth: 'A trace does not have a frequency. It has a spectrum, and any single number quoted for it, such as "30 Hz data," is a summary of that spectrum rather than a measurement of the rock.'
    },
    'phase spectrum': {
      aka: ['spectral phase'], mod: 'components', title: 'Module 03',
      what: 'The time shift applied to each frequency, plotted against frequency. Amplitude says how much of each frequency is present, phase says where each one sits.',
      earth: 'Raw spectral phase varies mainly with traveltime, so it tracks how deep the reflector is rather than what it is made of. Correcting for that traveltime leaves a residue that follows lateral changes in the reflecting interval, which is the version of phase that is interpretable.'
    },
    'bandwidth': {
      mod: 'spectrum', title: 'Module 01',
      what: 'The width of the range of frequencies a waveform carries, usually measured where the amplitude spectrum falls to half its peak value. It is defined more than one way, and the AASPI documentation itself uses two conventions across different programs.',
      earth: 'Bandwidth, not peak frequency alone, sets how thin a bed can be separated into a top and a base. Widening the band shortens the wavelet in time; narrowing it lengthens the wavelet and adds oscillations after each reflection that can be mistaken for beds.'
    },
    'peak frequency': {
      mod: 'spectrum', title: 'Module 01',
      what: 'The frequency at which the amplitude spectrum reaches its maximum.',
      earth: 'On balanced data the peak frequency of a short interval falls where a bed of about half a period thickness resonates, so a map of it responds to bed thickness. On unbalanced data it largely reproduces the source wavelet, and a map of it can look like structure while containing none.'
    },
    'dominant frequency': {
      mod: 'spectrum', title: 'Module 01',
      what: 'A loosely used name for the frequency that most characterizes a wavelet, taken by different authors to mean the peak of the spectrum, the mean of the spectrum, or the reciprocal of the interval between successive troughs in the time domain.',
      earth: 'The three definitions give different numbers for the same data. A thickness quoted from a dominant frequency is only as well defined as the convention behind it.'
    },
    'mean frequency': {
      mod: 'attributes', title: 'Module 06',
      what: 'The amplitude-weighted average frequency of a spectrum: the balance point of the spectrum rather than its highest point.',
      earth: 'It moves less abruptly than peak frequency because it responds to the whole spectrum rather than to one maximum, so it is more stable where the spectrum has two comparable maxima and less sensitive where a single narrow one moves.'
    },
    'magnitude': {
      mod: 'components', title: 'Module 03',
      what: 'The size of the spectral amplitude at one frequency and one time, ignoring its phase. Every spectral decomposition returns a magnitude and a phase at each frequency; the magnitude is what is usually displayed.',
      earth: 'A large magnitude at one frequency indicates that the interval contains a spacing that resonates at that frequency, or simply that the reflection is strong. Magnitude does not by itself separate a thickness effect from a contrast effect.'
    },
    'octave': {
      aka: ['octaves'], mod: 'spectrum', title: 'Module 01',
      what: 'A doubling of frequency. A band from 10 to 40 Hz spans two octaves; a band from 50 to 80 Hz, thirty hertz wide as well, spans less than one.',
      earth: 'Resolution responds to the ratio of the band edges rather than their difference, so a low-frequency band of a given width in hertz does more for resolution than a high-frequency band of the same width. This is why extending data downward in frequency is valued.'
    },
    'nyquist frequency': {
      aka: ['nyquist'], mod: 'spectrum', title: 'Module 01',
      what: 'Half the sampling rate: the highest frequency a given sample interval can represent. Data sampled every 4 ms have a Nyquist frequency of 125 Hz.',
      earth: 'Energy above the Nyquist frequency is not lost but folded back into the recorded band, where it appears as an ordinary signal at a frequency it never had. This is why the sample interval is chosen before acquisition rather than corrected afterward.'
    },
    'aliasing': {
      aka: ['aliased', 'alias'], mod: 'spectrum', title: 'Module 01',
      what: 'The appearance of a frequency above the Nyquist limit as a lower frequency within the recorded band, because too few samples were taken to distinguish the two.',
      earth: 'An aliased event is indistinguishable from a real one by inspection: it has a plausible amplitude and a plausible frequency. Spatial aliasing works the same way with trace spacing in place of sample interval, and makes a steeply dipping reflector appear to dip the other way.'
    },
    'wavelength': {
      aka: ['wavelengths'], mod: 'spectrum', title: 'Module 01',
      what: 'Velocity divided by frequency: the distance in the ground occupied by one cycle. At 2500 m/s a 30 Hz component has a wavelength of about 83 m.',
      earth: 'Bed thickness is compared against wavelength rather than against frequency. Velocity rises with depth and the earth absorbs the higher frequencies on the way, so wavelengths at depth are longer and the thinnest recognizable bed is thicker there than it is shallow.'
    },
    'sidelobe': {
      aka: ['sidelobes', 'ringing'], mod: 'spectrum', title: 'Module 01',
      what: 'The oscillations before and after the central peak of a wavelet. A spectrum with sharp edges produces long, slowly decaying sidelobes; tapering the edges shortens them.',
      earth: 'Sidelobes are troughs and peaks that no boundary produced. Around a strong reflection they can be picked as beds that are not there, and a stack of thin beds can be reported where one strong interface exists.'
    },
    'analysis window': {
      aka: ['analysis windows'], mod: 'windows', title: 'Module 02',
      what: 'The length of trace over which one spectrum is computed. A spectrum is a property of an interval, not of a sample, so the interval has to be chosen before anything can be measured.',
      earth: 'A window long enough to give a well-resolved spectrum averages over more geology than the target, and a window short enough to isolate the target resolves frequency poorly. The choice is set by which of the two errors matters more for the question being asked.'
    },
    'window length': {
      mod: 'windows', title: 'Module 02',
      what: 'The duration of the analysis window, which fixes the finest frequency spacing obtainable from it. A 40 ms window cannot distinguish frequencies closer together than about 25 Hz.',
      earth: 'This is a property of the arithmetic and not of the data or the processing. No amount of care in acquisition removes it.'
    },
    'spectrogram': {
      aka: ['time-frequency plot', 'time frequency plot'], mod: 'windows', title: 'Module 02',
      what: 'A display of the spectrum at every time down a trace: time on one axis, frequency on the other, magnitude as color.',
      earth: 'It shows where in the section a spectral change occurs, which a single spectrum of the whole trace cannot. A gradual downward loss of high frequencies is absorption; an abrupt local one is a property of the interval at that depth.'
    },
    'stationarity': {
      aka: ['stationary', 'nonstationary', 'non-stationary'], mod: 'windows', title: 'Module 02',
      what: 'The assumption that the spectrum does not change over the interval being analyzed. One spectrum for a whole trace assumes it holds for the whole trace.',
      earth: 'Real traces are not stationary. Velocity, bed thickness and absorption all change with depth, and a single spectrum for the entire record averages a shallow section over a deep one and describes neither.'
    },
    'leakage': {
      mod: 'windows', title: 'Module 02',
      what: 'Energy from one frequency appearing at neighboring frequencies because the analysis window cut the waveform at its ends. Tapering the window reduces it at the cost of a broader response.',
      earth: 'Leakage puts amplitude at frequencies the interval does not contain, and a weak component beside a strong one can be leakage from the strong one rather than a separate feature.'
    },
    'spectral component': {
      aka: ['spectral components', 'voice', 'voices', 'iso-frequency map', 'iso-frequency section', 'isofrequency'], mod: 'components', title: 'Module 03',
      what: 'The part of the data at one frequency, kept as a volume in its own right. Producing one is close to applying a narrow bandpass filter and keeping the amplitude that survives.',
      earth: 'A component at one frequency responds most strongly to beds of about half a period in thickness, so different components brighten different parts of the same body. Nothing new is recorded; the same data are separated into parts that were summed together in the original trace.'
    },
    'continuous wavelet transform': {
      aka: ['CWT'], mod: 'methods', title: 'Module 08',
      what: 'A decomposition that correlates the trace against one waveform stretched and compressed to different scales, so the analysis window is short at high frequencies and long at low ones.',
      earth: 'Time resolution is therefore better for the high frequencies and frequency resolution better for the low ones, which suits data in which the shallow section is broadband and the deep section is not. The result carries the shape of the analyzing waveform, which is an assumption about the data rather than a measurement of it.'
    },
    'matching pursuit': {
      mod: 'methods', title: 'Module 08',
      what: 'A decomposition that repeatedly subtracts from the trace whichever waveform from a fixed dictionary fits it best, and keeps the list of waveforms removed.',
      earth: 'It produces a sparse description, so a thin bed can be resolved more sharply than a window-based method allows. When the data do not resemble anything in the dictionary the fit is forced anyway, and the error appears as structure in the result rather than as an obvious failure.'
    },
    'tuning': {
      aka: ['tuned', 'tuning amplitude'], mod: 'tuning', title: 'Module 04',
      what: 'The constructive interference between the reflection from the top of a bed and the reflection from its base when the two are close enough in time to overlap. At one particular thickness the sum reaches a maximum.',
      earth: 'A bright amplitude at tuning thickness records a thickness, not a rock property and not a fluid. The same bed with the same fluid and the same impedance contrast is brighter at one thickness than at another, so an amplitude map of a body whose thickness varies is in part a thickness map. Separating a thickness effect from a contrast effect requires more than one amplitude.'
    },
    'tuning thickness': {
      aka: ['amplitude tuning thickness', 'spectral tuning thickness'], mod: 'tuning', title: 'Module 04',
      what: 'The bed thickness at which the top and base reflections interfere most constructively. Two different quantities go by this name: the spectral relation T = 1/(2 f), which is exact for the frequency at which a notch appears, and the thickness at which a specific wavelet reaches maximum amplitude, which depends on the shape of that wavelet. For a 30 Hz Ricker wavelet they are 16.7 ms and about 13 ms.',
      earth: 'A thickness read off an amplitude map depends on which of the two was used, and the difference is large enough to matter for a reservoir estimate.'
    },
    'quarter wavelength': {
      aka: ['quarter-wavelength'], mod: 'tuning', title: 'Module 04',
      what: 'A bed one quarter of a wavelength thick. The wave crosses it twice, down and back, so the reflection from the base travels half a wavelength further than the reflection from the top and arrives half a cycle behind it. The base of a bed carries the opposite polarity to its top, and that polarity flip turns the half-cycle delay into constructive interference, so the two reflections add.',
      earth: 'It is the usual shorthand for the resolution limit, and it is a limit on separating two events rather than on detecting a bed. Beds far thinner than a quarter wavelength are still visible; what is lost is the ability to measure their thickness from the time between two picks.'
    },
    'thin bed': {
      aka: ['thin beds'], mod: 'tuning', title: 'Module 04',
      what: 'A bed thinner than the tuning thickness of the data, so that its top and base return a single composite waveform rather than two separable ones.',
      earth: 'Below tuning the time between the top and the base stops changing as the bed thins, so apparent thickness read from the section is constant while the true thickness continues to fall. The amplitude keeps falling, which is the only remaining measure of how thin the bed has become.'
    },
    'notch': {
      aka: ['notches'], mod: 'tuning', title: 'Module 04',
      what: 'A frequency at which the two reflections from a bed cancel, leaving a minimum in the spectrum of the interval. Successive notches are spaced by 1/T, where T is the two-way time through the bed.',
      earth: 'The spacing of notches measures the bed thickness directly and is independent of the wavelet. This is the relation that makes bed thickness recoverable from a spectrum rather than from an amplitude.'
    },
    'widess limit': {
      aka: ['Widess'], mod: 'tuning', title: 'Module 04',
      what: 'The thickness, about one eighth of a wavelength, below which the composite waveform stops changing shape and only its amplitude continues to fall.',
      earth: 'Below it a thickness cannot be recovered from the waveform at all without an independent amplitude calibration, because every thickness produces the same shape.'
    },
    'operator': {
      aka: ['balancing operator', 'operators'], mod: 'balancing', title: 'Module 05',
      what: 'A list of numbers, one for each frequency. Applying it means multiplying the amplitude at each frequency by the number beside it. A balancing operator is large where the wavelet made the data weak and small where it made them strong, so that every frequency in the band comes out at about the same amplitude afterward.',
      earth: 'A gain curve applied to a trace against time does the same kind of thing; this one works against frequency. Nothing is added to the data by multiplying them: the notches and peaks the beds produced were already there, weighted by the wavelet, and what the multiplication removes is the weighting.'
    },
    'spectral balancing': {
      aka: ['spectral balance'], mod: 'balancing', title: 'Module 05',
      what: 'Dividing the spectrum of the data by a smooth estimate of the spectrum of the wavelet, so that the result reflects the reflectivity rather than the source.',
      earth: 'Peak frequency measured on unbalanced data mostly reproduces the source wavelet and its variation across the survey, which can resemble structure. Balancing is what makes a peak frequency map a statement about the rocks rather than about the acquisition.'
    },
    'whitening': {
      aka: ['whitened', 'white'], mod: 'balancing', title: 'Module 05',
      what: 'Balancing to a flat spectrum, so that every frequency in the band carries equal amplitude.',
      earth: 'A flat spectrum gives the shortest wavelet available from a given band, which sharpens thin beds and separates events that overlapped. It also raises the frequencies at which the data carry the least signal, so noise rises with the resolution.'
    },
    'prewhitening': {
      aka: ['prewhitened', 'pre-whitening'], mod: 'balancing', title: 'Module 05',
      what: 'Adding a small constant to the estimated spectrum before dividing by it, so that frequencies with almost no amplitude are not multiplied by a very large number. The AASPI documentation gives the constant as 1%, 2% and 4% in different programs.',
      earth: 'Without it, the balancing operator amplifies whatever occupies the ends of the band, which is usually noise.'
    },
    'bluing': {
      aka: ['blued', 'blue'], mod: 'balancing', title: 'Module 05',
      what: 'Balancing to a spectrum that rises with frequency rather than a flat one, controlled by an exponent applied to frequency.',
      earth: 'Well log reflectivity series are not white; their spectra rise toward high frequencies. Balancing seismic data to a rising spectrum rather than a flat one is an attempt to match that, and makes seismic and log-derived reflectivity more nearly comparable.'
    },
    'trace-by-trace': {
      aka: ['trace by trace'], mod: 'balancing', title: 'Module 05',
      what: 'Estimating and removing a separate balancing operator at every trace, rather than one operator for the whole survey.',
      earth: 'A notch caused by a bed is a property of that place. An operator estimated at that place includes the notch and divides it out, removing the feature the analysis was looking for. A survey-average operator cannot do this, which is why spec_cwt and spec_cmp use one.'
    },
    'peak magnitude': {
      mod: 'attributes', title: 'Module 06',
      what: 'The amplitude of the spectrum at its peak frequency, taken sample by sample.',
      earth: 'It measures how strongly the interval responds at whatever frequency suits it best. Where it is near zero the peak frequency at the same sample is close to meaningless, because there is no maximum to locate.'
    },
    'rgb blend': {
      aka: ['RGB blending', 'RGB blends'], mod: 'blending', title: 'Module 07',
      what: 'Three iso-frequency volumes displayed at once, one in each of the red, green and blue color channels, so that color encodes which frequencies are strong.',
      earth: 'Color in such a display corresponds to the mixture of thicknesses present rather than to any single measured quantity, which is why one color bar cannot describe it. A body that appears red is responding at the low frequency, and one that appears blue at the high frequency, so a change in hue along a body is a change in its thickness.'
    },
    'corender': {
      aka: ['corendering', 'co-render', 'co-rendering'], mod: 'blending', title: 'Module 07',
      what: 'Showing two or more attributes in one image by giving each of them a different visual property — a color channel, a hue, a lightness, an opacity — rather than drawing them as separate maps. AASPI carries it as a program of that name.',
      earth: 'One attribute is usually chosen for what it locates and another for what it measures, so that a single image answers both questions: a structural attribute to place an edge, and a spectral one to say what the body inside that edge is doing.'
    },
    'hue and lightness display': {
      aka: ['hue-lightness', 'hue and lightness', 'hlplot'], mod: 'blending', title: 'Module 07',
      what: 'One particular co-render, in which one attribute is mapped to hue and a second to lightness. AASPI carries it as hlplot, separately from corender.',
      earth: 'Mapping peak frequency to hue and peak magnitude to lightness makes the display dark exactly where the frequency estimate is unreliable, so the least trustworthy values are the least visible.'
    },
    'low-frequency shadow': {
      aka: ['low frequency shadow', 'low-frequency shadows'], mod: 'shadows', title: 'Module 09',
      what: 'A local loss of high frequencies immediately beneath a reflector, seen as a downward shift of the spectrum in a limited area.',
      earth: 'Gas-bearing sands can produce one, and so can a thick channel below tuning, a bad statics solution, and a mispositioned event. The observation is a spectral change; the cause is not determined by the observation alone.'
    },
    'quality factor': {
      aka: ['Q factor', 'Q'], mod: 'shadows', title: 'Module 09',
      what: 'A measure of how much energy a rock removes from a passing wave per cycle. A low quality factor means strong absorption.',
      earth: 'Absorption is cumulative and frequency-dependent: the deeper the reflector, the more of the high end has been removed on the way, and the longer the wavelet that comes back. Part of the downward loss of resolution in any survey is this rather than acquisition.'
    },
    'attenuation': {
      aka: ['absorption', 'attenuated'], mod: 'shadows', title: 'Module 09',
      what: 'The loss of amplitude with distance traveled, greater at high frequencies than at low ones.',
      earth: 'It shifts the whole spectrum downward with depth. A peak frequency map made deep in a survey and one made shallow are not on the same scale, and comparing them without accounting for it compares two different wavelets.'
    },
    'direct hydrocarbon indicator': {
      aka: ['DHI', 'direct hydrocarbon indicators'], mod: 'shadows', title: 'Module 09',
      what: 'A seismic observation taken as evidence of hydrocarbons: a bright amplitude, a flat event cutting structure, a polarity reversal, a low-frequency shadow.',
      earth: 'Each has causes other than hydrocarbons. A bright amplitude is produced by tuning at a particular thickness, by a hard streak, and by a gas sand; the observation does not distinguish them, and the number of independent indicators present matters more than the strength of any one.'
    },
    'resolution': {
      aka: ['resolvable'], mod: 'tuning', title: 'Module 04',
      what: 'The minimum separation at which two reflections can be recognized as two rather than one. It is distinct from detection, which is whether a bed produces any measurable response at all.',
      earth: 'A bed well below the resolution limit is still detectable, sometimes as a strong amplitude. What cannot be done is to measure its thickness from the time between two picks, because there is only one event to pick.'
    },
    'artifact': {
      aka: ['artifacts'], mod: 'shadows', title: 'Module 09',
      what: 'A feature in a result produced by the processing rather than by the subsurface.',
      earth: 'Spectral methods produce characteristic ones: sidelobes from a sharp filter edge, ringing from a short window, and a rim of high peak frequency around the edge of any strong body. Recognizing them is a matter of knowing what the method does, not of inspecting the image more carefully.'
    }
  };

  /* =====================================================================
     MARKING THE TEXT
     ===================================================================== */

  /* Where a module lives, seen from the page doing the asking. */
  var PREFIX = /\/modules\//.test(location.pathname) ? '' : 'modules/';

  /* One flat list of every spelling, longest first, so that "peak frequency"
     is matched before "frequency" would be. */
  var INDEX = [];
  (function () {
    for (var key in TERMS) {
      if (!Object.prototype.hasOwnProperty.call(TERMS, key)) continue;
      INDEX.push({ text: key, key: key });
      var aka = TERMS[key].aka || [];
      for (var i = 0; i < aka.length; i++) INDEX.push({ text: aka[i], key: key });
    }
    INDEX.sort(function (a, b) { return b.text.length - a.text.length; });
  })();

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* Text worth marking: the explanatory prose of each step. Headings, labels,
     controls, references and the term list itself are left alone. */
  var SCOPE_SEL = '.tabpane p.lede, .tabpane p.qbox, .tabpane .legend span, .tabpane li';
  var SKIP_TAGS = { A: 1, BUTTON: 1, CODE: 1, LABEL: 1, H1: 1, H2: 1, H3: 1, H4: 1, SUMMARY: 1 };

  function markScope(root, seen) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      var bad = false, p = n.parentNode;
      while (p && p !== root) {
        if (SKIP_TAGS[p.tagName] || (p.className && String(p.className).indexOf('gterm') >= 0)) {
          bad = true; break;
        }
        p = p.parentNode;
      }
      if (!bad && n.nodeValue && n.nodeValue.trim()) nodes.push(n);
    }

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      for (var j = 0; j < INDEX.length; j++) {
        var entry = INDEX[j];
        if (seen[entry.key]) continue;
        var re = new RegExp('(^|[^A-Za-z-])(' + escapeRe(entry.text) + ')(?![A-Za-z-])', 'i');
        var m = re.exec(node.nodeValue);
        if (!m) continue;
        var at = m.index + m[1].length;
        var after = node.splitText(at);
        after.splitText(m[2].length);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gterm';
        btn.setAttribute('data-term', entry.key);
        btn.textContent = after.nodeValue;
        after.parentNode.replaceChild(btn, after);
        seen[entry.key] = true;
        break;   // one node, one mark; the rest of it is left as it was
      }
    }
  }

  function markAll() {
    var panes = document.querySelectorAll('.tabpane');
    for (var i = 0; i < panes.length; i++) {
      if (panes[i].id === 'pk' || panes[i].id === 'pm') continue;  // definitions, references
      var seen = {};
      var scopes = panes[i].querySelectorAll(SCOPE_SEL);
      for (var j = 0; j < scopes.length; j++) markScope(scopes[j], seen);
    }
  }

  /* =====================================================================
     THE CARD
     ===================================================================== */

  var CSS = [
    '.gterm { font: inherit; color: inherit; background: none; padding: 0;',
    '  border: 0; border-bottom: 1px dotted var(--crimson,#841617); cursor: help; }',
    '.gterm:hover, .gterm:focus { background: rgba(132,22,23,.07); outline: none; }',
    '.gcard { position: absolute; z-index: 60; max-width: 380px;',
    '  background: var(--paper,#fff); border: 1px solid var(--rule,#C9CDD2);',
    '  box-shadow: 0 10px 26px -12px rgba(22,25,28,.5); padding: 14px 16px 12px; }',
    '.gcard h4 { font-family: var(--display,Archivo,sans-serif); font-size: 14.5px;',
    '  margin: 0 0 8px; color: var(--ink,#16191C); }',
    '.gcard p { font-size: 13px; line-height: 1.62; margin: 0 0 8px;',
    '  color: var(--ink,#16191C); }',
    '.gcard p.g-earth { color: var(--slate,#5C6670); }',
    '.gcard .g-tag { font-family: var(--mono,monospace); font-size: 9.5px;',
    '  letter-spacing: .1em; text-transform: uppercase;',
    '  color: var(--crimson,#841617); display: block; margin-bottom: 3px; }',
    '.gcard .g-foot { display: flex; gap: 10px; align-items: center;',
    '  justify-content: space-between; margin-top: 10px; padding-top: 9px;',
    '  border-top: 1px solid var(--rule,#C9CDD2); font-size: 12px; }',
    '.gcard button.g-x { border: 0; background: none; cursor: pointer;',
    '  font: inherit; color: var(--slate,#5C6670); text-decoration: underline; }'
  ].join('\n');

  var card = null;

  function injectStyle() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function entryHtml(key) {
    var t = TERMS[key];
    return '<h4>' + key.replace(/^./, function (c) { return c.toUpperCase(); }) + '</h4>' +
      '<p><span class="g-tag">What it is</span>' + t.what + '</p>' +
      '<p class="g-earth"><span class="g-tag">In the rocks</span>' + t.earth + '</p>';
  }

  function closeCard() {
    if (card && card.parentNode) card.parentNode.removeChild(card);
    card = null;
  }

  function showCard(btn) {
    closeCard();
    var key = btn.getAttribute('data-term');
    var t = TERMS[key];
    if (!t) return;

    card = document.createElement('div');
    card.className = 'gcard';
    card.innerHTML = entryHtml(key) +
      '<div class="g-foot">' +
        '<a href="' + PREFIX + t.mod + '.html">Introduced in ' + t.title + '</a>' +
        '<span><button type="button" class="g-x" data-act="keep">Keep in a window</button> ' +
        '<button type="button" class="g-x" data-act="close">Close</button></span>' +
      '</div>';
    document.body.appendChild(card);

    var r = btn.getBoundingClientRect();
    var top = r.bottom + window.pageYOffset + 8;
    var left = r.left + window.pageXOffset;
    var overflow = (left + card.offsetWidth) - (window.pageXOffset + document.documentElement.clientWidth - 16);
    if (overflow > 0) left -= overflow;
    card.style.top = top + 'px';
    card.style.left = Math.max(8, left) + 'px';

    card.addEventListener('click', function (ev) {
      var act = ev.target.getAttribute && ev.target.getAttribute('data-act');
      if (act === 'close') closeCard();
      if (act === 'keep') { keep(key); closeCard(); }
    });
  }

  /* =====================================================================
     THE REFERENCE WINDOW

     One window per module, and terms accumulate in it, so a reader working
     through a step can collect the four words they did not know and keep
     them side by side with the module.
     ===================================================================== */

  var ref = null;

  function headLinks() {
    var out = '';
    var links = document.querySelectorAll('head link[rel="stylesheet"], head link[rel="preconnect"]');
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      out += '<link rel="' + l.rel + '" href="' + l.href + '"' +
             (l.crossOrigin ? ' crossorigin' : '') + '>\n';
    }
    return out;
  }

  function keep(key) {
    if (!ref || ref.closed) {
      var name = 'glossary_' + (location.pathname || 'm').replace(/[^A-Za-z0-9]+/g, '_');
      try {
        ref = window.open('', name, 'width=460,height=680,scrollbars=yes,resizable=yes');
      } catch (e) { ref = null; }
      if (!ref) return;
      ref.document.open();
      ref.document.write('<!doctype html>\n<html lang="en">\n<head>\n' +
        '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
        '<title>Terms</title>\n' + headLinks() +
        '<style>\nbody { margin:0; padding:20px; background:var(--paper,#fff); }\n' + CSS +
        '\n.gcard { position:static; max-width:none; box-shadow:none; margin:0 0 14px; }\n' +
        '.g-foot { display:none; }\n' +
        'h1 { font-family:var(--display,Archivo,sans-serif); font-size:16px; margin:0 0 14px;\n' +
        '  padding-bottom:10px; border-bottom:1px solid var(--rule,#d8d8d8); }\n</style>\n' +
        '</head>\n<body>\n<h1>Terms from this module</h1>\n<div id="gList"></div>\n</body>\n</html>');
      ref.document.close();
    }
    var list = ref.document.getElementById('gList');
    if (!list) return;
    if (list.querySelector('[data-key="' + key + '"]')) { ref.focus(); return; }
    var d = ref.document.createElement('div');
    d.className = 'gcard';
    d.setAttribute('data-key', key);
    d.innerHTML = entryHtml(key);
    list.appendChild(d);
    ref.focus();
  }

  /* =====================================================================
     WIRING
     ===================================================================== */

  function init() {
    if (!document.querySelector('.tabpane')) return;
    injectStyle();
    markAll();

    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.classList && t.classList.contains('gterm')) { showCard(t); return; }
      if (card && !card.contains(t)) closeCard();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeCard();
    });
    window.addEventListener('resize', closeCard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
