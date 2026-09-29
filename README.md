<div align="center">

# नाद · Naad

**A riyaz mirror for the bansuri.**

Play into your microphone. Naad draws the waveform as a continuous line, names the
swara you are on, and tells you whether your breath and your transitions were clean.

One HTML file. No build step, no dependencies, no server, no account.
Nothing leaves your device.

</div>

---

## Run it

**macOS** — double-click `Start Naad.command`.

**Anything else** — serve the folder and open it:

```bash
python3 -m http.server 8731 --bind 127.0.0.1
# then visit http://localhost:8731/naad.html
```

A local server is required, not optional. Browsers refuse microphone access to a page
opened straight off disk (`file://`), while `localhost` counts as a secure origin.
For the same reason this cannot be hosted inside an embedded preview frame — those
do not pass microphone permission through.

---

## What it shows

**Waveform** — an oscilloscope trace, phase-locked to your own pitch, so a steady note
*freezes the wave*. The steadiness feedback is the picture, not a number.

**Swara** — सा / Sa, the saptak (mandra · madhya · taar), the frequency, and a cents
needle. All twelve swaras including komal and teevra variants.

**Breath** — for each finished note: how it started, how steady the middle was, and
what happened to it by the end.

> *"That Sa arrived with a shove — 5.5 dB louder than the body of the note and about
> 21 cents sharp before it settled. Start it like the beginning of a sigh."*

> *"Over 3.4 s the note lost 11.6 dB and sagged 22 cents flat at the same time. You ran
> out of breath rather than finishing the note."*

**Transitions** — every change between swaras classified as **crisp**, **meend**,
**blipped**, **broken**, **overshot** or **hesitant**, with the glide time in
milliseconds and which swara you flashed through on the way.

**Modes** — free play, hold-a-swara, aroha–avaroha, alankar, plus a tanpura-style drone
on Sa and Pa.

---

## Any bansuri, not just C

Naad works with every scale of flute. Settings has presets for ten —

| | | | | |
|---|---|---|---|---|
| C natural medium · Sa C5 | C♯ medium · Sa C♯5 | D natural medium · Sa D5 | E natural medium · Sa E5 | F natural medium · Sa F5 |
| G natural medium · Sa G4 | A natural medium · Sa A4 | B natural medium · Sa B4 | F natural bass · Sa F4 | C natural bass · Sa C4 |

— plus a free Sa-frequency field for anything not listed, and an A₄ calibration for the
432 Hz instruments some makers sell. The detector's search range follows your Sa rather
than sitting at a fixed window, so the top of an F medium (taar Ni at 2637 Hz) and the
bottom of a C bass (mandra Pa at 196 Hz) are both in range.

Click the scale in the header, or open Settings.

## Set your Sa first

Bansuris are named inconsistently. Indian makers name a flute by its **Sa** — the note
with the top three holes closed. Some sellers and most Western catalogues name it by the
**pipe note**, with all six holes closed, which is a perfect fourth lower.

On a C natural medium: **Sa = C5 = 523.25 Hz**, and all six holes closed sounds
**G4 = 392 Hz**, which is mandra Pa — *not* Sa. Mistaking one for the other puts every
octave label in the app wrong.

So don't trust the label on the bamboo. Play your Sa and press **Settings → Tune to my
Sa**. Naad snaps to the nearest semitone and is then correct for whatever you own.
There are presets for ten common flutes and an A₄ calibration (432 Hz bansuris exist).

A 6-hole bansuri's low register stops at mandra Pa, so the built-in exercises never ask
for mandra Re, Ga or Ma.

---

## How it works

| | |
|---|---|
| Pitch detection | McLeod Pitch Method (NSDF) over an FFT autocorrelation, 2048-sample window |
| Audio graph | two taps off one source — 35 Hz DC block for the display, 130 Hz + 5 kHz band for the detector |
| Waveform | hysteresis-armed rising zero crossing, sub-sample interpolated, previous-frame correlation lock, Catmull-Rom as cubic Bézier |
| Breath envelope | separate 256-sample (5.3 ms) block RMS |
| Everything else | Canvas 2D, one `requestAnimationFrame` loop |

Three details worth knowing, because each was a bug first:

**The MPM lobe skip must start at lag 0, not at the minimum lag.** For a high note the
whole first lobe can sit below the minimum lag; starting there lands mid-lobe, skips the
true peak and locks onto twice the period — a confident reading exactly one octave low.

**Attack time cannot be measured from the detector's RMS.** RMS over a 2048-sample
window is a 43 ms moving average, so even an instantaneous onset takes ~21 ms to
register. You would be measuring the window, not the player. Hence the separate 5.3 ms
envelope path.

**Ornaments are not faults.** A regular oscillation is vibrato, kampan or andolan however
deep it swings — only its *rate* or its irregularity can be wrong. Departure from a note
is therefore judged on a 100 ms running mean, which a symmetric ornament averages back
to its own centre and a real move to another swara does not.

### Constants that were measured, not guessed

| Constant | Value | How it was chosen |
|---|---:|---|
| MPM key-maximum `k` | `0.93` | Swept 0.80–0.99 over 7 spectra × 8 pitches × 5 conditions. Zero octave errors across 0.80–0.98; breaks at 0.99. |
| Clarity gate | `0.32` on / `0.24` off | Measured: pure tone 1.00, noisy tone 0.92, a very breathy beginner tone **0.43**, breath noise and room tone **0.07**. A high gate would mute exactly the airy tone a learner produces. |
| Detector window | `2048` @ 48 kHz | 43 ms; locks onto a new swara 39 ms after the change; 0.135 ms/frame — 0.8% of a 60 fps budget. |

---

## Tests

```
$ node test/run.cjs

1. Pitch detector — accuracy, octave errors, throughput
  40 clean tones, 196–3136 Hz, 4 spectra including a missing fundamental
  octave errors: 0   worst fine error: 2.29 cents
  survives breath noise up to 0.10 RMS
  clarity — pure tone 1.00 · very airy tone 0.35 · breath noise 0.06
  0.102 ms/call — 0.6% of a 60 fps frame

2. Swara mapping — every swara of every flute, mandra Pa to taar Ni
  72 exact round trips (equal temperament and just intonation)
  870 notes · misnamed 0 · octave errors 0 · worst 11.66 cents

3. Breath envelope and swara transitions — synthetic performances
  punched + collapsing Sa .......... start and fade both caught
  controlled diminuendo ............ praised, not faulted
  vibrato ±10¢ ..................... one note, wobble 1.3¢, read as intentional
  andolan ±60¢ ..................... one note, wobble 3.6¢, read as intentional
  transitions ...................... crisp 33ms · meend 167ms · broken 233ms · blipped 350ms
  breath pause between phrases ..... not called a fault
  32 cents flat .................... reported
```

The harness extracts the analysis code straight out of `naad.html`, so the tests cannot
drift from what ships — if the app breaks, they break.

Testing this way found the octave-halving bug, a segmenter deadlock where a deep andolan
produced *zero* notes, and several places that faulted good playing: vibrato scored as
wobble, a deliberate diminuendo read as running out of breath, and a breath pause
reported as a broken note.

---

## Known limits

- Chrome on macOS sometimes ignores the request for raw audio. Naad detects this and
  says so: pitch stays accurate, but the breath and volume readings get flattened by the
  browser's automatic gain control. Firefox and Safari honour the request.
- With the drone on, use headphones or Naad will hear its own drone.
- A cold bansuri reads flat. Warm it before trusting the cents.

## Licence

MIT.
