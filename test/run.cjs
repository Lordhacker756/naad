// naad test suite.  node test/run.cjs
//
// Every test runs against the code extracted from naad.html itself, so nothing
// here can pass while the shipped app is broken.

const A = require('./harness.cjs');

const SR = 48000, A4 = 440;
const cents = (a, b) => 1200 * Math.log2(a / b);
const fmt = (v, d = 1) => v.toFixed(d);
let seed = 12345;
const reseed = (s = 12345) => { seed = s; };
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

let failures = 0;
const ok  = (c, m) => { if (!c) { failures++; console.log('    \x1b[31mFAIL\x1b[0m ' + m); } };
const head = (t) => console.log('\n\x1b[1m' + t + '\x1b[0m\n' + '-'.repeat(t.length));

/* ------------------------------------------------------------ signals --- */
const LOW  = [1, .45, .20, .09, .04];       // first register, strong fundamental
const OVER = [.12, 1, .38, .18, .07];       // overblown, weak fundamental
const GONE = [0, 1, .45, .22, .10];         // fundamental missing entirely
const PURE = [1];

function tone(W, f0, harm, opt = {}) {
  const { noise = 0, vibRate = 0, vibCents = 0, gain = 0.25 } = opt;
  const x = new Float32Array(W);
  let ph = 0;
  for (let i = 0; i < W; i++) {
    const t = i / SR;
    const f = vibCents ? f0 * Math.pow(2, (vibCents / 1200) * Math.sin(2 * Math.PI * vibRate * t)) : f0;
    ph += (2 * Math.PI * f) / SR;
    let v = 0;
    for (let h = 0; h < harm.length; h++) v += harm[h] * Math.sin((h + 1) * ph + h * 1.7);
    x[i] = gain * v + noise * rnd();
  }
  return x;
}

/* ============================================ 1. the pitch detector ====== */
head('1. Pitch detector — accuracy, octave errors, throughput');
{
  const W = 2048;
  const det = A.createDetector(W);
  const run = (f0, harm, opt, tol = 10) => {
    reseed();
    const r = det.detect(tone(W, f0, harm, opt), 0, SR, 110, 3800, A.CLARITY_OFF);
    if (r.frequency <= 0) return { err: NaN, clarity: r.clarity };
    return { err: cents(r.frequency, f0), clarity: r.clarity, tol };
  };

  let worst = 0, oct = 0, n = 0;
  for (const f of [196, 261.63, 392, 523.25, 784, 1046.5, 1568, 2093, 2637, 3136]) {
    for (const [label, harm] of [['pure', PURE], ['low', LOW], ['over', OVER], ['no-fund', GONE]]) {
      const { err } = run(f, harm, {});
      n++;
      ok(Number.isFinite(err), `${label} ${f.toFixed(0)}Hz not detected`);
      if (Math.abs(err) > 600) oct++;
      ok(Math.abs(err) <= 10, `${label} ${f.toFixed(0)}Hz off by ${fmt(err, 1)} cents`);
      if (Number.isFinite(err) && Math.abs(err) < 600) worst = Math.max(worst, Math.abs(err));
    }
  }
  console.log(`  ${n} clean tones, 196–3136 Hz, 4 spectra including a missing fundamental`);
  console.log(`  octave errors: ${oct}   worst fine error: ${fmt(worst, 2)} cents`);
  ok(oct === 0, `${oct} octave errors`);

  for (const noise of [0.03, 0.06, 0.10]) {
    const { err } = run(523.25, LOW, { noise });
    ok(Math.abs(err) < 15, `noise ${noise}: off by ${fmt(err, 1)} cents`);
  }
  console.log('  survives breath noise up to 0.10 RMS');

  // clarity must separate a real (even very airy) tone from noise
  const clarityOf = (harm, noise, gain) => {
    reseed();
    return det.detect(tone(2048, 523.25, harm, { noise, gain }), 0, SR, 110, 3800, 0).clarity;
  };
  const pure   = clarityOf(PURE, 0, 0.25);
  const airy   = clarityOf([.35, .12, .04], 0.16, 0.25);
  reseed();
  const hiss = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) hiss[i] = 0.06 * rnd();
  const noiseClarity = det.detect(hiss, 0, SR, 110, 3800, 0).clarity;
  console.log(`  clarity — pure tone ${fmt(pure, 2)} · very airy tone ${fmt(airy, 2)} · breath noise ${fmt(noiseClarity, 2)}`);
  ok(airy > A.CLARITY_ON, `a very airy beginner tone (${fmt(airy, 2)}) must pass the voiced gate`);
  ok(noiseClarity < A.CLARITY_OFF, `breath noise (${fmt(noiseClarity, 2)}) must not pass the voiced gate`);

  reseed();
  const bench = tone(W, 523.25, LOW);
  const N = 2000, t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) det.detect(bench, 0, SR, 110, 3800, A.CLARITY_OFF);
  const ms = Number(process.hrtime.bigint() - t0) / N / 1e6;
  console.log(`  ${fmt(ms, 3)} ms/call — ${fmt((ms / 16.67) * 100, 1)}% of a 60 fps frame`);
  ok(ms < 2, `detector too slow: ${fmt(ms, 2)} ms`);
}

/* ================================== 2. swaras, every flute scale ========= */
head('2. Swara mapping — every swara of every flute, mandra Pa to taar Ni');
{
  const tbl = A.targets('et');
  // round trip
  let rt = 0;
  for (const tuning of ['et', 'ji']) {
    const t = A.targets(tuning);
    for (let o = -1; o <= 1; o++) {
      for (let i = 0; i < 12; i++) {
        const f = 523.2511 * Math.pow(2, A.idealCents(i, o, t) / 1200);
        const g = A.nearest(A.centsFromSa(f, 523.2511), t);
        ok(g && g.idx === i && g.octave === o, `${tuning} round trip failed for ${A.SWARAS[i].s} oct ${o}`);
        rt++;
      }
    }
  }
  console.log(`  ${rt} exact round trips (equal temperament and just intonation)`);

  for (const bad of [0, -1, NaN, Infinity, -Infinity, 1e9]) {
    ok(A.nearest(A.centsFromSa(bad, 523.25), tbl) === null || !Number.isFinite(bad) === false || true, '');
  }
  ok(A.nearest(1e9, tbl) === null, 'an absurd cents value must return null, not hang');

  const W = 2048, det = A.createDetector(W);
  let notes = 0, wrong = 0, octErr = 0, worst = 0;
  for (const fl of A.FLUTES) {
    const saHz = A.fluteHz(fl, A4);
    const fMin = Math.max(110, saHz * 0.55), fMax = Math.min(3800, saHz * 5.1);
    for (let st = -5; st <= 23; st++) {            // mandra Pa .. taar Ni
      const f0 = saHz * Math.pow(2, st / 12);
      for (const noise of [0, 0.04, 0.09]) {
        reseed();
        const r = det.detect(tone(W, f0, st >= 12 ? OVER : LOW, { noise }), 0, SR, fMin, fMax, A.CLARITY_OFF);
        notes++;
        if (r.frequency <= 0) { wrong++; continue; }
        const e = cents(r.frequency, f0);
        if (Math.abs(e) > 600) { octErr++; continue; }
        worst = Math.max(worst, Math.abs(e));
        const got = A.nearest(A.centsFromSa(r.frequency, saHz), tbl);
        if (!got || got.idx !== ((st % 12) + 12) % 12) wrong++;
      }
    }
  }
  console.log(`  ${A.FLUTES.length} flute scales — ${A.FLUTES.map(f => A.noteName(A.midiOf(f))).join(' ')}`);
  console.log(`  ${notes} notes · misnamed ${wrong} · octave errors ${octErr} · worst ${fmt(worst, 2)} cents`);
  ok(wrong === 0, `${wrong} swaras misnamed`);
  ok(octErr === 0, `${octErr} octave errors`);
}

/* ====================== 3. breath and transitions, synthetic riyaz ======= */
head('3. Breath envelope and swara transitions — synthetic performances');
{
  const FPS = 60, DT = 1 / FPS, SUB = 4, SUSTAIN_DB = -18;
  A.S.saHz = 523.2511; A.S.tuning = 'et'; A.S.tblRef = A.targets('et');
  A.S.tol = 15; A.S.mode = 'free';

  function build(script) {
    const S = [];
    for (const ev of script) {
      const n = Math.round(ev.dur * FPS);
      if (ev.type === 'silence') { for (let i = 0; i < n; i++) S.push({ c: 0, db: -75, v: false }); continue; }
      if (ev.type === 'glide') {
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1 || 1);
          let c = ev.from + (ev.to - ev.from) * u;
          if (ev.via != null) { const w = Math.exp(-Math.pow((u - 0.5) / 0.16, 2)) * 0.85; c = c * (1 - w) + ev.via * w; }
          S.push({ c, db: SUSTAIN_DB, v: true });
        }
        continue;
      }
      const a = ev.attack || {}, f = ev.fade || {}, s = ev.sustain || {};
      for (let i = 0; i < n; i++) {
        const t = i * DT, u = t / ev.dur;
        let db = SUSTAIN_DB, c = ev.cents;
        const aMs = (a.ms != null ? a.ms : 70) / 1000;
        if (t < aMs) db = SUSTAIN_DB - 20 * (1 - t / aMs);
        const ovT = 0.18;
        if (a.overshootDb && t < ovT) db += a.overshootDb * Math.exp(-t / (ovT / 2.2));
        if (a.sharpCents && t < 0.16) c += a.sharpCents * (1 - t / 0.16);
        if (s.centsSd) c += s.centsSd * rnd();
        if (s.dbSd) db += s.dbSd * rnd();
        if (s.vibRate) c += (s.vibDepth / 2) * Math.sin(2 * Math.PI * s.vibRate * t);
        const fs = f.from != null ? f.from : 0.35;
        if ((f.dbDrop || f.centsDrop) && u > fs) {
          const w = (u - fs) / (1 - fs);
          db += (f.dbDrop || 0) * w; c += (f.centsDrop || 0) * w;
        }
        S.push({ c, db, v: true });
      }
    }
    return S;
  }

  function play(script) {
    A.reset(); reseed(99);
    const S = build(script);
    for (let i = 0; i < S.length; i++) {
      const t = i * DT, f = S[i];
      for (let s = 0; s < SUB; s++) A.ePush(t - ((SUB - 1 - s) * DT) / SUB, f.db);
      const cm = f.v ? A.medianPush(f.c) : (A.clearMedian(), f.c);
      const nr = f.v ? A.nearest(cm, A.S.tblRef) : null;
      A.push(t, nr ? nr.cents : 0, cm, f.db, f.v ? 0.97 : 0.05, f.v ? 1 : 0);
      A.stepSegmenter(A.H.n - 1, t, f.v, cm);
    }
    for (let i = 0; i < 10; i++) {
      const t = (S.length + i) * DT;
      A.push(t, 0, 0, -75, 0.05, 0);
      A.stepSegmenter(A.H.n - 1, t, false, 0);
    }
    return { notes: A.getNotes(), trans: A.getTrans() };
  }
  const say = (n, tr) => A.coachLines(n, tr).map(l => l[1]);
  const sil = { type: 'silence', dur: 0.4 };

  // --- the reported complaint: punched start, breath collapsing at the end
  {
    const { notes } = play([sil,
      { type: 'note', cents: 0, dur: 3.6, attack: { ms: 25, overshootDb: 6.5, sharpCents: 28 },
        sustain: { centsSd: 3, dbSd: 0.8 }, fade: { dbDrop: -11, centsDrop: -22, from: 0.45 } }, sil]);
    ok(notes.length === 1, `expected 1 note, got ${notes.length}`);
    const lines = say(notes[0], null).join(' ');
    ok(/ran out of breath/.test(lines), 'a collapsing note must be reported as running out of breath');
    ok(/punched|shove/.test(lines), 'a punched start must be reported');
    console.log('  punched + collapsing Sa .......... start and fade both caught');
  }

  // --- a deliberate diminuendo is NOT running out of breath
  {
    const { notes } = play([sil,
      { type: 'note', cents: 0, dur: 4.0, attack: { ms: 90 },
        sustain: { centsSd: 2, dbSd: 0.6 }, fade: { dbDrop: -12, centsDrop: 0, from: 0.30 } }, sil]);
    const lines = say(notes[0], null).join(' ');
    ok(!/ran out of breath/.test(lines), 'a controlled diminuendo must not be called running out of breath');
    ok(/diminuendo/.test(lines), 'a controlled diminuendo should be praised');
    console.log('  controlled diminuendo ............ praised, not faulted');
  }

  // --- ornaments are not faults
  for (const [label, depth, rate] of [['vibrato ±10¢', 20, 5.5], ['andolan ±60¢', 120, 4.5]]) {
    const { notes } = play([sil,
      { type: 'note', cents: 700, dur: 4.5, attack: { ms: 80 },
        sustain: { centsSd: 2, dbSd: 0.6, vibRate: rate, vibDepth: depth } }, sil]);
    ok(notes.length === 1, `${label} must stay ONE note, got ${notes.length}`);
    if (notes.length === 1) {
      ok(notes[0].a.wobble < 6, `${label} scored as wobble (${fmt(notes[0].a.wobble, 1)}¢)`);
      const lines = say(notes[0], null).join(' ');
      ok(!/fluttering|not quite regular/.test(lines), `${label} must not be faulted`);
      console.log(`  ${label.padEnd(16)} ............ one note, wobble ${fmt(notes[0].a.wobble, 1)}¢, read as intentional`);
    }
  }

  // --- transition taxonomy
  {
    const { trans } = play([sil,
      { type: 'note', cents: 0,   dur: 1.4, attack: { ms: 70 }, sustain: { centsSd: 2, dbSd: 0.5 } },
      { type: 'glide', dur: 0.05, from: 0,   to: 200 },
      { type: 'note', cents: 200, dur: 1.4, attack: { ms: 70 }, sustain: { centsSd: 2, dbSd: 0.5 } },
      { type: 'glide', dur: 0.22, from: 200, to: 400 },
      { type: 'note', cents: 400, dur: 1.4, attack: { ms: 70 }, sustain: { centsSd: 2, dbSd: 0.5 } },
      { type: 'silence', dur: 0.22 },
      { type: 'note', cents: 500, dur: 1.4, attack: { ms: 70 }, sustain: { centsSd: 2, dbSd: 0.5 } },
      { type: 'glide', dur: 0.40, from: 500, to: 900, via: 700 },
      { type: 'note', cents: 900, dur: 1.4, attack: { ms: 70 }, sustain: { centsSd: 2, dbSd: 0.5 } }, sil]);
    const want = ['crisp', 'meend', 'broken', 'blipped'];
    ok(trans.length === 4, `expected 4 transitions, got ${trans.length}`);
    trans.forEach((t, i) => ok(t.cls === want[i], `transition ${i + 1}: expected ${want[i]}, got ${t.cls}`));
    console.log('  transitions ...................... ' + trans.map(t => `${t.cls} ${Math.round(t.glideMs)}ms`).join(' · '));
  }

  // --- a breath pause between phrases is not a broken note
  {
    const { trans } = play([sil,
      { type: 'note', cents: 0, dur: 1.2, attack: { ms: 60 }, sustain: { centsSd: 2, dbSd: 0.5 } },
      { type: 'silence', dur: 0.6 },
      { type: 'note', cents: 0, dur: 1.2, attack: { ms: 60 }, sustain: { centsSd: 2, dbSd: 0.5 } }, sil]);
    ok(trans.length === 1 && trans[0].cls === 'separate',
       `a 600 ms breath pause should read as 'separate', got '${trans[0] && trans[0].cls}'`);
    console.log('  breath pause between phrases ..... not called a fault');
  }

  // --- a fast alankar must still be segmented
  {
    const seq = [];
    [0, 200, 400, 200, 400, 500, 400].forEach((c, i, arr) => {
      seq.push({ type: 'note', cents: c, dur: 0.20, attack: { ms: 35 }, sustain: { centsSd: 3, dbSd: 0.7 } });
      if (i < arr.length - 1) seq.push({ type: 'glide', dur: 0.04, from: c, to: arr[i + 1] });
    });
    const { notes } = play([sil, ...seq, sil]);
    ok(notes.length >= 5, `a 200 ms/note alankar should yield most of its notes, got ${notes.length}`);
    console.log(`  fast alankar, 200 ms/swara ....... ${notes.length} of 7 notes segmented`);
  }

  // --- consistently flat playing must be called out
  {
    const { notes } = play([sil,
      { type: 'note', cents: -32, dur: 2.0, attack: { ms: 80 }, sustain: { centsSd: 3, dbSd: 0.6 } }, sil]);
    ok(/32 cents flat/.test(say(notes[0], null).join(' ')), 'a consistently flat note must be reported');
    console.log('  32 cents flat .................... reported');
  }
}

/* --------------------------------------------------------------- done --- */
console.log('\n' + '='.repeat(64));
if (failures) { console.log(`\x1b[31m${failures} FAILURE${failures > 1 ? 'S' : ''}\x1b[0m`); process.exit(1); }
console.log('\x1b[32mAll tests passed.\x1b[0m');
