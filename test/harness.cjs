// Loads the real analysis code out of naad.html so the tests cannot drift from
// what ships. Everything above the RENDERING banner is pure logic — the FFT,
// the pitch detector, the swara tables, the segmenter, the breath and
// transition analysers — so we slice that out, stub the handful of browser
// globals it touches at load time, and hand back the internals.

const fs = require('fs');
const path = require('path');

function fakeEl() {
  const t = {
    style: {}, dataset: {}, children: [], childElementCount: 0,
    firstElementChild: null, lastChild: null, hidden: false, textContent: '',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, insertBefore() {}, removeChild() {},
    addEventListener() {}, matches() { return false; },
    showModal() {}, close() {}, focus() {}, querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  return t;
}

const STUBS = `
  var document = { getElementById: function(){ return FAKE(); },
    querySelectorAll: function(){ return []; }, createElement: function(){ return FAKE(); },
    addEventListener: function(){}, readyState: 'complete',
    documentElement: { removeAttribute: function(){}, setAttribute: function(){} } };
  var window = { devicePixelRatio: 1, addEventListener: function(){},
    matchMedia: function(){ return { addEventListener: function(){}, matches: false }; } };
  window.self = window; window.top = window;
  var navigator = { mediaDevices: null };
  var localStorage = { getItem: function(){ return null; }, setItem: function(){} };
  var getComputedStyle = function(){ return { getPropertyValue: function(){ return '#000000'; } }; };
  var ResizeObserver = function(){}; ResizeObserver.prototype.observe = function(){};
  var requestAnimationFrame = function(){ return 0; };
  var cancelAnimationFrame = function(){};
`;

const EXPORTS = `
  return {
    createDetector: createDetector,
    SWARAS: SWARAS, FLUTES: FLUTES, OCT_NAME: OCT_NAME,
    targets: targets, nearest: nearest, idealCents: idealCents,
    centsFromSa: centsFromSa, fluteHz: fluteHz, midiOf: midiOf, noteName: noteName,
    S: S, H: H, E: E, push: push, ePush: ePush, toDb: toDb,
    medianPush: medianPush, clearMedian: function(){ medBuf.length = 0; },
    stats: stats, slope: slope, vibrato: vibrato,
    stepSegmenter: stepSegmenter, analyseNote: analyseNote, coachLines: coachLines,
    fmt: fmt, FFT_SIZE: FFT_SIZE, CLARITY_ON: CLARITY_ON, CLARITY_OFF: CLARITY_OFF,
    getNotes: function(){ return notes; },
    getTrans: function(){ return transitions; },
    getSeg: function(){ return seg; },
    getCur: function(){ return cur; },
    setOnNoteDone: function(f){ onNoteDone = f; },
    reset: function () {
      H.n = 0; E.n = 0; notes.length = 0; transitions.length = 0; cur = null;
      medBuf.length = 0;
      seg.state = 'silent'; seg.run = 0; seg.pend = 0; seg.win = 0;
      seg.leaveSign = 0; seg.dBuf = []; seg.left = false;
    }
  };
`;

function build() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'naad.html'), 'utf8');
  const js = html.split('<script>')[1].split('</script>')[0];

  const marker = '/* ======================================================== RENDERING';
  const cut = js.indexOf(marker);
  if (cut < 0) throw new Error('RENDERING banner not found — did naad.html change shape?');

  let body = js.slice(0, cut);
  // onNoteDone lives below the cut; declare a mutable stub before first use.
  body = body.replace('function beginNote(k, t, centre) {',
                      'var onNoteDone = function(){};\nfunction beginNote(k, t, centre) {');
  const u = body.indexOf("'use strict';");
  body = body.slice(u + "'use strict';".length);

  // eslint-disable-next-line no-new-func
  return new Function('FAKE', '"use strict";' + STUBS + body + EXPORTS)(fakeEl);
}

module.exports = build();
