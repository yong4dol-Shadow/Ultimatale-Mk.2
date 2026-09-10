/* =====================================================================
   audio.js - a tiny chiptune tracker on top of WebAudio.

   No audio files ship with the game: every track is a pattern string
   played back on pulse / triangle / noise voices, the way a 16-bit sound
   chip would have done it.  Patterns are written one token per 16th
   note - "c4" plays, "-" sustains, "." rests.
   ===================================================================== */
(function (SH) {
  'use strict';

  var ac = null, master = null, muted = false;
  var NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  function freq(tok) {
    var m = /^([a-g])([#b]?)(-?\d)$/.exec(tok);
    if (!m) return 0;
    var s = NOTE[m[1]] + (m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0));
    var oct = parseInt(m[3], 10);
    return 440 * Math.pow(2, (s + (oct - 4) * 12 - 9) / 12);
  }

  function ensure() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.32;
    master.connect(ac.destination);
    return ac;
  }

  /* ---- voices ------------------------------------------------------- */
  var noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    var n = ac.sampleRate * 0.5;
    noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /* A pulse wave built from a periodic wave - the classic NES/Genesis
     lead timbre.  duty is 0.5 (square), 0.25 or 0.125. */
  var pulseCache = {};
  function pulseWave(duty) {
    if (pulseCache[duty]) return pulseCache[duty];
    var n = 32, real = new Float32Array(n), imag = new Float32Array(n);
    for (var i = 1; i < n; i++) {
      real[i] = 2 / (i * Math.PI) * Math.sin(Math.PI * i * duty);
    }
    pulseCache[duty] = ac.createPeriodicWave(real, imag);
    return pulseCache[duty];
  }

  function tone(f, t, dur, vol, kind, slide) {
    if (!f) return;
    var o = ac.createOscillator(), g = ac.createGain();
    if (kind === 'tri') o.type = 'triangle';
    else if (kind === 'saw') o.type = 'sawtooth';
    else o.setPeriodicWave(pulseWave(kind === 'pulse25' ? 0.25 : (kind === 'pulse12' ? 0.125 : 0.5)));
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(f * slide, 20), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function drum(kindChar, t, vol) {
    if (kindChar === 'k') {                       // kick
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(vol * 1.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.18);
      return;
    }
    var src = ac.createBufferSource(), gn = ac.createGain(), fl = ac.createBiquadFilter();
    src.buffer = noise();
    fl.type = 'highpass';
    fl.frequency.value = kindChar === 'h' ? 7000 : 1500;
    var dur = kindChar === 'h' ? 0.045 : 0.14;
    gn.gain.setValueAtTime(vol * (kindChar === 'h' ? 0.55 : 1.0), t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(gn); gn.connect(master);
    src.start(t); src.stop(t + dur);
  }

  /* A shaped noise burst - the piece the plain kick/snare/hat drums could
     not cover.  Everything that is supposed to sound like an impact (a
     round striking armour, a body going up) is noise pushed through a
     filter sweep, not a tone. */
  function burst(t, opts) {
    var o = opts || {};
    var src = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain();
    var dur = o.dur || 0.12;
    src.buffer = noise();
    src.playbackRate.value = o.rate || 1;
    fl.type = o.type || 'bandpass';
    fl.Q.value = o.q === undefined ? 1.0 : o.q;
    fl.frequency.setValueAtTime(o.f0 || 2000, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(o.f1 || o.f0 || 2000, 40), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(o.vol === undefined ? 0.2 : o.vol, t + (o.atk || 0.004));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(gn); gn.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  /* ---- tracks -------------------------------------------------------- */
  function P(s) { return s.trim().split(/\s+/); }

  /* Original compositions, not transcriptions. They chase the feel the
     series is known for - minor-key rock over a 16th-note bass engine,
     fast arpeggio pads, syncopated breaks - with a lead, a counter, a
     bass and drums per track instead of the thin two- or three-voice
     sketches these started as. */
  var TRACKS = {

    /* main title - slow, ominous, then it opens up */
    title: { bpm: 100, ch: [
      { kind: 'pulse25', vol: 0.15, pat: P(
        'a4 -  -  .  c5 -  -  .  e5 -  -  -  d5 -  -  . ' +
        'a4 -  -  .  c5 -  -  .  b4 -  a4 -  g4 -  -  - ' +
        'f4 -  -  .  a4 -  -  .  c5 -  -  -  b4 -  -  . ' +
        'e4 -  g4 -  b4 -  e5 -  d5 -  c5 -  b4 -  -  - ') },
      { kind: 'pulse12', vol: 0.07, pat: P(
        '.  .  e4 .  .  .  a4 .  .  .  b4 .  .  .  .  . ' +
        '.  .  e4 .  .  .  a4 .  .  .  g4 .  .  .  .  . ' +
        '.  .  f4 .  .  .  c5 .  .  .  e5 .  .  .  .  . ' +
        '.  .  b4 .  .  .  e5 .  .  .  b4 .  .  .  .  . ') },
      { kind: 'tri', vol: 0.22, pat: P(
        'a1 .  a2 .  a1 .  a2 .  a1 .  a2 .  e2 .  e1 . ' +
        'a1 .  a2 .  a1 .  a2 .  g1 .  g2 .  g1 .  g2 . ' +
        'f1 .  f2 .  f1 .  f2 .  c2 .  c3 .  c2 .  c3 . ' +
        'e1 .  e2 .  e1 .  e2 .  e1 .  b1 .  e1 .  e2 . ') },
      { kind: 'noise', vol: 0.13, pat: P(
        'k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h ' +
        'k  .  h  .  s  .  h  .  k  .  h  k  s  .  h  . ' +
        'k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h ' +
        'k  .  h  .  s  .  h  .  k  s  k  s  h  s  h  s ') }
    ]},

    /* Westopolis - the city burning, driving rock */
    city: { bpm: 154, ch: [
      { kind: 'pulse12', vol: 0.13, pat: P(
        'e5 .  e5 .  g5 .  e5 d5 .  b4 .  d5 e5 .  .  . ' +
        'b4 .  d5 .  e5 .  g5 .  a5 .  g5 e5 d5 .  .  . ' +
        'c5 .  c5 .  e5 .  c5 b4 .  g4 .  b4 c5 .  .  . ' +
        'd5 .  f#5 . a5 .  g5 .  f#5 . e5 .  d5 .  .  . ') },
      { kind: 'pulse', vol: 0.08, pat: P(
        'b4 .  b4 .  d5 .  b4 a4 .  g4 .  a4 b4 .  .  . ' +
        'g4 .  b4 .  b4 .  d5 .  e5 .  d5 b4 a4 .  .  . ' +
        'g4 .  g4 .  c5 .  g4 e4 .  e4 .  g4 g4 .  .  . ' +
        'a4 .  d5 .  f#5 . d5 .  a4 .  b4 .  a4 .  .  . ') },
      { kind: 'pulse25', vol: 0.06, pat: P(
        'e4 g4 b4 e5 g4 b4 e5 g4 b4 e5 g4 b4 e5 g4 b4 e5 ' +
        'e4 g4 b4 e5 g4 b4 e5 g4 b4 e5 g4 b4 e5 g4 b4 e5 ' +
        'c4 e4 g4 c5 e4 g4 c5 e4 g4 c5 e4 g4 c5 e4 g4 c5 ' +
        'd4 f#4 a4 d5 f#4 a4 d5 f#4 a4 d5 a4 f#4 d4 f#4 a4 d5 ') },
      { kind: 'tri', vol: 0.24, pat: P(
        'e2 e2 e3 e2 e2 e3 e2 e2 e2 e3 e2 e2 e3 e2 e2 e2 ' +
        'e2 e2 e3 e2 e2 e3 e2 e2 b2 b2 b3 b2 b2 b3 b2 b2 ' +
        'c2 c2 c3 c2 c2 c3 c2 c2 c2 c3 c2 c2 c3 c2 c2 c2 ' +
        'd2 d2 d3 d2 d2 d3 d2 d2 d2 d3 d2 d2 a2 a2 b2 b2 ') },
      { kind: 'noise', vol: 0.15, pat: P(
        'k  h  s  h  k  h  s  h  k  k  s  h  k  h  s  h ' +
        'k  h  s  h  k  h  s  h  k  k  s  h  k  s  k  s ' +
        'k  h  s  h  k  h  s  h  k  k  s  h  k  h  s  h ' +
        'k  h  s  h  k  h  s  h  k  s  k  s  k  s  s  s ') }
    ]},

    /* Space Colony ARK - cold, wide, an old machine still turning */
    ark: { bpm: 120, ch: [
      { kind: 'pulse25', vol: 0.12, pat: P(
        'd4 -  -  f4 -  -  a4 -  -  -  g4 -  f4 -  -  . ' +
        'c4 -  -  e4 -  -  g4 -  -  -  f4 -  e4 -  -  . ' +
        'bb3 - -  d4 -  -  f4 -  -  -  e4 -  d4 -  -  . ' +
        'a3 -  -  c4 -  -  e4 -  g4 -  f4 -  e4 -  d4 - ') },
      { kind: 'pulse12', vol: 0.05, pat: P(
        'd5 .  .  .  a4 .  .  .  f5 .  .  .  a4 .  .  . ' +
        'c5 .  .  .  g4 .  .  .  e5 .  .  .  g4 .  .  . ' +
        'bb4 . .  .  f4 .  .  .  d5 .  .  .  f4 .  .  . ' +
        'a4 .  .  .  e4 .  .  .  c5 .  .  .  e5 .  .  . ') },
      { kind: 'tri', vol: 0.21, pat: P(
        'd2 .  .  d2 .  .  d2 .  a1 .  .  a1 .  .  a1 . ' +
        'c2 .  .  c2 .  .  c2 .  g1 .  .  g1 .  .  g1 . ' +
        'bb1 . .  bb1 . .  bb1 . f1 .  .  f1 .  .  f1 . ' +
        'a1 .  .  a1 .  .  e2 .  a1 .  .  a1 .  e2 .  . ') },
      { kind: 'noise', vol: 0.09, pat: P(
        'h  .  .  h  .  .  h  .  h  .  .  h  .  .  s  . ' +
        'h  .  .  h  .  .  h  .  h  .  .  h  .  .  s  . ' +
        'h  .  .  h  .  .  h  .  h  .  .  h  .  .  s  . ' +
        'h  .  .  h  .  s  h  .  h  .  s  h  .  s  s  s ') }
    ]},

    /* Black Comet - alien, dissonant, crawling */
    comet: { bpm: 132, ch: [
      { kind: 'saw', vol: 0.10, pat: P(
        'c4 .  db4 . c4 .  ab3 . g3 .  ab3 . c4 .  db4 . ' +
        'eb4 . d4 .  c4 .  ab3 . g3 .  f3 .  g3 .  .  . ' +
        'c4 .  db4 . eb4 . db4 . c4 .  b3 .  c4 .  eb4 . ' +
        'ab4 . g4 .  f4 .  eb4 . db4 . c4 .  b3 .  .  . ') },
      { kind: 'pulse12', vol: 0.06, pat: P(
        '.  .  .  .  ab4 . .  .  .  .  .  .  eb4 . .  . ' +
        '.  .  .  .  b4 .  .  .  .  .  .  .  g4 .  .  . ' +
        '.  .  .  .  ab4 . .  .  .  .  .  .  c5 .  .  . ' +
        '.  .  .  .  eb5 . .  .  .  .  .  .  b4 .  .  . ') },
      { kind: 'tri', vol: 0.23, pat: P(
        'c2 -  c2 db2 c2 -  c2 .  ab1 - ab1 . g1 -  g1 . ' +
        'c2 -  c2 db2 c2 -  c2 .  f1 -  f1 .  g1 -  g1 . ' +
        'c2 -  c2 db2 eb2 - eb2 . db2 - db2 . c2 -  c2 . ' +
        'ab1 - ab1 . g1 -  g1 .  f1 -  f1 .  g1 -  g1 g1 ') },
      { kind: 'noise', vol: 0.15, pat: P(
        'k  .  k  s  .  k  .  s  k  .  k  s  .  k  s  . ' +
        'k  .  k  s  .  k  .  s  k  s  k  s  k  s  k  s ' +
        'k  .  k  s  .  k  .  s  k  .  k  s  .  k  s  . ' +
        'k  s  k  s  k  s  k  s  k  s  s  s  k  s  s  s ') }
    ]},

    /* random encounter - fast, urgent, keeps moving */
    /* The regular battle theme runs 128 steps, not 64: at this tempo a
       64-step loop comes round every eleven seconds and you hear the seam
       long before the fight is over.  Eight bars, with the riff answering
       itself, a lift onto C at bar five, a descending turnaround and drum
       fills where the phrases join. */
    battle: { bpm: 168, ch: [
      { kind: 'pulse', vol: 0.13, pat: P(
        'a4  -   .   a4  .   c5  -   .   b4  .   a4  -   .   .   e4  .  ' +
        'g4  -   .   g4  .   b4  -   .   a4  .   g4  -   .   e4  d4  .  ' +
        'f4  -   .   f4  .   a4  -   .   g4  .   f4  -   .   .   c4  .  ' +
        'e4  -   .   e4  .   g4  -   .   b4  -   a4  -   g4  -   -   .  ' +
        'a4  -   c5  -   e5  -   .   e5  .   d5  -   c5  .   b4  -   .  ' +
        'c5  -   e5  -   a5  -   .   a5  .   g5  -   e5  .   d5  -   .  ' +
        'f5  -   e5  -   d5  -   c5  -   b4  -   a4  -   g4  -   e4  -  ' +
        'a4  -   -   -   .   .   e4  .   a4  -   -   -   -   -   -   .  ') },
      { kind: 'pulse25', vol: 0.07, pat: P(
        '.   .   e4  .   .   .   a3  .   .   e4  .   .   c4  .   .   .  ' +
        '.   .   d4  .   .   .   g3  .   .   d4  .   .   b3  .   .   .  ' +
        '.   .   c4  .   .   .   f3  .   .   c4  .   .   a3  .   .   .  ' +
        '.   .   b3  .   .   .   e3  .   .   .   e4  -   d4  -   -   .  ' +
        'e4  -   .   .   a4  -   .   .   g4  -   .   .   e4  -   .   .  ' +
        'a4  -   .   .   c5  -   .   .   b4  -   .   .   g4  -   .   .  ' +
        'a4  -   g4  -   f4  -   e4  -   d4  -   c4  -   b3  -   a3  -  ' +
        'e4  -   -   -   .   .   b3  .   e4  -   -   -   -   -   -   .  ') },
      { kind: 'pulse12', vol: 0.045, pat: P(
        'a5  e5  c5  e5  a5  e5  c5  e5  a5  e5  c5  e5  b5  e5  b4  e5 ' +
        'g5  d5  b4  d5  g5  d5  b4  d5  g5  d5  b4  d5  a5  e5  a4  e5 ' +
        'f5  c5  a4  c5  f5  c5  a4  c5  f5  c5  a4  c5  g5  d5  g4  d5 ' +
        'e5  b4  g4  b4  e5  b4  g4  b4  e5  b4  e5  g5  b5  -   -   .  ' +
        'a5  .   e5  .   c6  .   e5  .   a5  .   e5  .   b5  .   e5  .  ' +
        'c6  .   a5  .   e6  .   a5  .   c6  .   a5  .   d6  .   a5  .  ' +
        'f5  a5  c6  f6  e5  a5  c6  e6  d5  g5  b5  d6  c5  e5  g5  c6 ' +
        'a5  -   -   -   .   .   e6  .   a5  -   -   -   -   -   -   .  ') },
      { kind: 'tri', vol: 0.24, pat: P(
        'a1  a1  a2  a1  a1  a1  a2  a1  a1  a1  a2  a1  e2  e2  e2  e2 ' +
        'g1  g1  g2  g1  g1  g1  g2  g1  g1  g1  g2  g1  d2  d2  d2  d2 ' +
        'f1  f1  f2  f1  f1  f1  f2  f1  f1  f1  f2  f1  c2  c2  c2  c2 ' +
        'e1  e1  e2  e1  e1  e1  e2  e1  e1  e2  e1  e2  b1  b1  b1  b1 ' +
        'a1  a1  a2  a1  e2  e2  a1  a1  a1  a1  a2  a1  e2  e2  e2  e2 ' +
        'c2  c2  c1  c2  g1  g1  c2  c2  c2  c2  c1  c2  g1  g1  g1  g1 ' +
        'f1  f1  f2  f1  e1  e1  e2  e1  d1  d1  d2  d1  c1  c1  c2  c1 ' +
        'a1  a1  a2  a1  a1  a1  a2  a1  a1  a2  a1  a2  e2  e2  e2  e2 ') },
      { kind: 'noise', vol: 0.16, pat: P(
        'k   h   k   h   s   h   k   h   k   h   k   h   s   h   k   h  ' +
        'k   h   k   h   s   h   k   h   k   h   k   h   s   h   s   h  ' +
        'k   h   k   h   s   h   k   h   k   h   k   h   s   h   k   h  ' +
        'k   h   k   h   s   h   k   h   s   s   k   k   s   s   s   s  ' +
        'k   h   k   h   s   h   k   h   k   h   k   h   s   h   k   h  ' +
        'k   h   k   h   s   h   k   h   k   h   k   h   s   h   s   h  ' +
        'k   h   s   h   k   h   s   h   k   h   s   h   k   h   s   h  ' +
        'k   s   k   s   s   s   k   s   k   k   s   s   s   s   s   s  ') },
    ]},

    /* named boss - heavier, half-step menace */
    boss: { bpm: 180, ch: [
      { kind: 'pulse12', vol: 0.14, pat: P(
        'd4 d4 .  d4 f4 .  d4 .  g4 .  f4 .  e4 .  d4 . ' +
        'd4 d4 .  d4 f4 .  a4 .  g4 .  f4 .  e4 .  d4 . ' +
        'eb4 eb4 . eb4 g4 . eb4 . ab4 . g4 .  f4 .  eb4 . ' +
        'd4 .  f4 .  a4 .  d5 .  c5 .  bb4 . a4 .  .  . ') },
      { kind: 'saw', vol: 0.08, pat: P(
        'a3 a3 .  a3 c4 .  a3 .  d4 .  c4 .  b3 .  a3 . ' +
        'a3 a3 .  a3 c4 .  e4 .  d4 .  c4 .  b3 .  a3 . ' +
        'bb3 bb3 . bb3 db4 . bb3 . eb4 . db4 . c4 . bb3 . ' +
        'a3 .  c4 .  e4 .  a4 .  g4 .  f4 .  e4 .  .  . ') },
      { kind: 'pulse25', vol: 0.05, pat: P(
        'd5 f5 a5 d6 f5 a5 d6 f5 a5 d6 a5 f5 d5 f5 a5 d6 ' +
        'd5 f5 a5 d6 f5 a5 d6 f5 a5 d6 a5 f5 d5 f5 a5 d6 ' +
        'eb5 g5 bb5 eb6 g5 bb5 eb6 g5 bb5 eb6 bb5 g5 eb5 g5 bb5 eb6 ' +
        'd5 f5 a5 d6 a5 f5 d5 f5 a5 d6 a5 f5 d5 .  .  . ') },
      { kind: 'tri', vol: 0.26, pat: P(
        'd1 d1 d1 .  d1 d1 d1 .  d1 d1 d1 .  d1 d1 d1 d1 ' +
        'd1 d1 d1 .  d1 d1 d1 .  a1 a1 a1 .  a1 a1 a1 a1 ' +
        'bb0 bb0 bb0 . bb0 bb0 bb0 . bb0 bb0 bb0 . bb0 bb0 bb0 bb0 ' +
        'a0 a0 a0 .  a0 a0 a0 .  a0 a0 a0 a0 a0 a0 a0 a0 ') },
      { kind: 'noise', vol: 0.17, pat: P(
        'k  k  s  h  k  k  s  h  k  k  s  h  k  s  k  s ' +
        'k  k  s  h  k  k  s  h  k  k  s  h  k  s  s  s ' +
        'k  k  s  h  k  k  s  h  k  k  s  h  k  s  k  s ' +
        'k  s  k  s  k  s  k  s  s  s  s  s  k  s  s  s ') }
    ]},

    /* Last Story - Super Shadow vs Devil Doom, the fastest thing here */
    last: { bpm: 196, ch: [
      { kind: 'pulse', vol: 0.15, pat: P(
        'e5 .  d5 .  c5 .  b4 .  c5 .  d5 .  e5 .  g5 . ' +
        'e5 .  d5 .  c5 .  b4 .  a4 .  b4 .  c5 .  e5 . ' +
        'a5 .  g5 .  f5 .  e5 .  f5 .  g5 .  a5 .  c6 . ' +
        'b5 .  a5 .  g5 .  f#5 . g5 .  a5 .  b5 .  .  . ') },
      { kind: 'pulse25', vol: 0.09, pat: P(
        'b4 .  a4 .  g4 .  f#4 . g4 .  a4 .  b4 .  d5 . ' +
        'b4 .  a4 .  g4 .  f#4 . e4 .  f#4 . g4 .  b4 . ' +
        'e5 .  d5 .  c5 .  b4 .  c5 .  d5 .  e5 .  g5 . ' +
        'f#5 . e5 .  d5 .  c5 .  d5 .  e5 .  f#5 . .  . ') },
      { kind: 'pulse12', vol: 0.06, pat: P(
        'e6 b5 g5 e5 b5 g5 e5 b5 g5 e5 g5 b5 e6 b5 g5 e5 ' +
        'e6 b5 g5 e5 b5 g5 e5 b5 g5 e5 g5 b5 e6 b5 g5 e5 ' +
        'a5 e5 c5 a4 e5 c5 a4 e5 c5 a4 c5 e5 a5 e5 c5 a4 ' +
        'b5 f#5 d5 b4 f#5 d5 b4 f#5 d5 b4 d5 f#5 b5 .  .  . ') },
      { kind: 'tri', vol: 0.26, pat: P(
        'e1 e1 e1 e1 e1 e2 e1 e1 e1 e1 e1 e1 e1 e2 e1 e1 ' +
        'c1 c1 c1 c1 c1 c2 c1 c1 g1 g1 g1 g1 g1 g2 g1 g1 ' +
        'a0 a0 a0 a0 a0 a1 a0 a0 a0 a0 a0 a0 a0 a1 a0 a0 ' +
        'b0 b0 b0 b0 b0 b1 b0 b0 b0 b1 b0 b1 b0 b1 b0 b1 ') },
      { kind: 'noise', vol: 0.18, pat: P(
        'k  h  s  h  k  h  s  h  k  h  s  h  k  s  k  s ' +
        'k  h  s  h  k  h  s  h  k  h  s  k  s  k  s  k ' +
        'k  h  s  h  k  h  s  h  k  h  s  h  k  s  k  s ' +
        'k  s  k  s  k  s  s  s  k  s  k  s  s  s  s  s ') }
    ]},

    /* endings */
    ending_dark: { bpm: 86, ch: [
      { kind: 'saw', vol: 0.13, pat: P(
        'd3 -  -  -  f3 -  -  -  ab3 - -  -  g3 -  -  - ' +
        'c3 -  -  -  eb3 - -  -  d3 -  -  -  -  -  -  - ') },
      { kind: 'pulse25', vol: 0.06, pat: P(
        '.  .  d4 .  .  .  ab4 . .  .  f4 .  .  .  .  . ' +
        '.  .  c4 .  .  .  g4 .  .  .  d4 .  .  .  .  . ') },
      { kind: 'tri', vol: 0.22, pat: P(
        'd1 -  -  -  d1 -  -  -  ab0 - -  -  ab0 - -  - ' +
        'c1 -  -  -  c1 -  -  -  d1 -  -  -  d1 -  -  - ') },
      { kind: 'noise', vol: 0.08, pat: P(
        '.  .  .  .  s  .  .  .  .  .  .  .  s  .  .  . ' +
        '.  .  .  .  s  .  .  .  .  .  .  .  s  .  s  s ') }
    ]},
    ending_hero: { bpm: 104, ch: [
      { kind: 'pulse25', vol: 0.14, pat: P(
        'c4 -  e4 -  g4 -  -  .  a4 -  g4 -  e4 -  -  . ' +
        'f4 -  a4 -  c5 -  -  .  b4 -  g4 -  c4 -  -  - ') },
      { kind: 'pulse12', vol: 0.06, pat: P(
        'e5 .  .  .  c5 .  .  .  e5 .  .  .  g5 .  .  . ' +
        'a5 .  .  .  f5 .  .  .  d5 .  .  .  e5 .  .  . ') },
      { kind: 'tri', vol: 0.20, pat: P(
        'c2 -  g1 -  c2 -  g1 -  a1 -  e1 -  a1 -  e1 - ' +
        'f1 -  c2 -  f1 -  c2 -  g1 -  d2 -  g1 -  -  - ') },
      { kind: 'noise', vol: 0.09, pat: P(
        'k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h ' +
        'k  .  h  .  s  .  h  .  k  .  h  .  s  s  h  s ') }
    ]},
    ending_true: { bpm: 94, ch: [
      { kind: 'tri', vol: 0.20, pat: P(
        'a2 -  c3 -  e3 -  a3 -  g3 -  e3 -  c3 -  a2 - ' +
        'f2 -  a2 -  c3 -  f3 -  e3 -  c3 -  a2 -  -  - ') },
      { kind: 'pulse25', vol: 0.12, pat: P(
        'a4 -  -  -  g4 -  -  -  e4 -  -  -  c4 -  -  . ' +
        'd4 -  -  -  e4 -  -  -  a3 -  -  -  -  -  -  - ') },
      { kind: 'pulse12', vol: 0.05, pat: P(
        'e5 .  a5 .  .  .  e5 .  .  .  c5 .  .  .  .  . ' +
        'd5 .  a4 .  .  .  e5 .  .  .  a4 .  .  .  .  . ') },
      { kind: 'noise', vol: 0.07, pat: P(
        '.  .  h  .  .  .  h  .  .  .  h  .  .  .  h  . ' +
        '.  .  h  .  .  .  h  .  .  .  h  .  s  .  h  . ') }
    ]}
  };

  /* ---- scheduler ------------------------------------------------------ */
  var cur = null, step = 0, nextTime = 0, timer = null;

  function scheduleStep() {
    var t = nextTime, T = TRACKS[cur];
    if (!T) return;
    var spb = 60 / T.bpm / 4;                     // seconds per 16th
    T.ch.forEach(function (c) {
      var tok = c.pat[step % c.pat.length];
      if (!tok || tok === '.' || tok === '-') return;
      /* sustain: stretch the note over the following '-' tokens */
      var len = 1;
      while (c.pat[(step + len) % c.pat.length] === '-' && len < 16) len++;
      var dur = spb * len * 0.92;
      if (c.kind === 'noise') drum(tok[0], t, c.vol);
      else tone(freq(tok), t, dur, c.vol, c.kind);
    });
    nextTime += spb;
    step++;
  }

  function pump() {
    if (!ac || !cur) return;
    while (nextTime < ac.currentTime + 0.16) scheduleStep();
  }

  var Audio = SH.Audio = {
    play: function (name) {
      if (cur === name) return;
      if (!ensure()) return;
      if (ac.state === 'suspended') ac.resume();
      cur = name; step = 0; nextTime = ac.currentTime + 0.06;
      if (!timer) timer = setInterval(pump, 25);
      pump();
    },
    stop: function () { cur = null; },
    current: function () { return cur; },
    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.32;
      return muted;
    },
    isMuted: function () { return muted; },
    /* one-shot effects, also synthesised */
    sfx: function (name) {
      if (!ensure()) return;
      if (ac.state === 'suspended') ac.resume();
      var t = ac.currentTime;
      switch (name) {
        case 'move':    tone(880, t, 0.05, 0.10, 'pulse25'); break;
        case 'confirm': tone(660, t, 0.06, 0.13, 'pulse'); tone(990, t + 0.05, 0.09, 0.13, 'pulse'); break;
        case 'cancel':  tone(330, t, 0.09, 0.11, 'pulse25'); break;
        /* --- battle hits.  These used to be one drum plus one tone each,
           which is why every exchange sounded the same; they are now layered
           the way a 16-bit sound driver would have layered them: a noise
           transient for the impact, a body tone under it, a tail. */
        case 'hit':                                   /* a round finds armour */
          burst(t, { f0: 5200, f1: 900, q: 0.7, dur: 0.09, vol: 0.30 });
          tone(210, t, 0.13, 0.22, 'saw', 0.28);
          tone(1250, t + 0.005, 0.05, 0.10, 'pulse12', 0.35);   // metallic ring
          tone(78, t + 0.01, 0.18, 0.15, 'tri', 0.5);
          break;
        case 'slash':                                 /* an energy strike */
          burst(t, { f0: 900, f1: 6400, q: 2.2, dur: 0.10, vol: 0.16 });
          tone(1600, t, 0.09, 0.15, 'saw', 0.22);
          tone(2400, t + 0.02, 0.07, 0.09, 'pulse12', 0.3);
          drum('h', t + 0.01, 0.4);
          break;
        case 'hurt':                                  /* Shadow takes damage */
          burst(t, { f0: 3000, f1: 260, q: 0.6, dur: 0.20, vol: 0.30 });
          tone(300, t, 0.30, 0.24, 'saw', 0.24);
          tone(151, t + 0.01, 0.34, 0.18, 'pulse25', 0.32);     // the flat, ugly clash
          tone(60, t + 0.02, 0.30, 0.20, 'tri', 0.7);
          break;
        case 'spare':                                 /* mercy accepted */
          [523, 659, 784, 1047, 1319].forEach(function (f, i) {
            tone(f, t + i * 0.06, 0.30, 0.11, 'pulse25');
            tone(f * 2, t + i * 0.06, 0.22, 0.04, 'pulse12');   // shimmer octave
          });
          tone(262, t, 0.75, 0.10, 'tri');                      // bell body
          burst(t + 0.30, { f0: 6000, f1: 11000, q: 3, dur: 0.35, vol: 0.05 });
          break;
        case 'kill':                                  /* something goes up */
          burst(t, { f0: 4200, f1: 120, q: 0.5, dur: 0.55, vol: 0.34 });
          burst(t + 0.05, { type: 'lowpass', f0: 1400, f1: 90, dur: 0.7, vol: 0.22 });
          tone(120, t, 0.55, 0.26, 'saw', 0.18);
          tone(52, t + 0.03, 0.85, 0.22, 'tri', 0.6);
          drum('k', t, 1.0); drum('k', t + 0.07, 0.6);
          break;
        case 'graze':                                 /* a bullet shaves past */
          burst(t, { f0: 5200, f1: 9000, q: 6, dur: 0.10, vol: 0.07 });
          tone(2093, t, 0.05, 0.05, 'pulse12', 1.5);
          tone(3136, t + 0.03, 0.07, 0.03, 'pulse12', 1.3);
          break;
        case 'pickup':  [784, 1047, 1319].forEach(function (f, i) { tone(f, t + i * 0.05, 0.12, 0.12, 'pulse'); }); break;
        case 'heal':    [523, 784].forEach(function (f, i) { tone(f, t + i * 0.09, 0.22, 0.11, 'tri'); }); break;
        case 'unlock':  [392, 523, 659, 880].forEach(function (f, i) { tone(f, t + i * 0.08, 0.2, 0.13, 'pulse25'); }); break;
        case 'deny':    tone(180, t, 0.16, 0.15, 'saw'); tone(140, t + 0.1, 0.16, 0.15, 'saw'); break;
        /* the encounter sting: two warning blips, then the screen slams */
        case 'encounter':
          tone(1200, t, 0.07, 0.16, 'pulse12');
          tone(1200, t + 0.10, 0.07, 0.16, 'pulse12');
          burst(t + 0.20, { f0: 3800, f1: 200, q: 0.6, dur: 0.30, vol: 0.26 });
          tone(600, t + 0.20, 0.26, 0.18, 'saw', 0.35);
          tone(300, t + 0.20, 0.40, 0.16, 'pulse25', 0.5);
          tone(75, t + 0.22, 0.50, 0.20, 'tri', 0.7);
          drum('k', t + 0.20, 1.1);
          break;
        /* Chaos Spear: charge whine, then a lance that cracks the air */
        case 'chaos':
          for (var ci = 0; ci < 9; ci++) {
            tone(200 * Math.pow(1.34, ci), t + ci * 0.024, 0.16, 0.10, 'saw');
          }
          tone(3200, t + 0.20, 0.07, 0.22, 'pulse12', 0.12);   // the crack
          tone(1800, t + 0.20, 0.14, 0.16, 'saw', 0.14);
          [1046, 1568, 2093].forEach(function (f, i) {          // golden ring
            tone(f, t + 0.22 + i * 0.03, 0.34, 0.11, 'pulse25', 0.7);
          });
          tone(110, t + 0.20, 0.42, 0.22, 'tri', 0.45);
          drum('s', t + 0.20, 0.85);
          drum('h', t + 0.26, 0.5);
          break;
        /* Chaos Blast: an implosion that inverts into a detonation */
        case 'blast':
          for (var bi = 0; bi < 10; bi++) {                     // suck-in
            tone(1400 - bi * 120, t + bi * 0.035, 0.10, 0.08, 'saw', 0.85);
          }
          var bt = t + 0.40;
          tone(70, bt, 1.5, 0.34, 'saw', 0.18);                 // sub drop
          tone(140, bt, 1.0, 0.26, 'tri', 0.22);
          tone(210, bt, 0.7, 0.20, 'saw', 0.3);
          drum('k', bt, 1.5); drum('k', bt + 0.06, 1.2); drum('k', bt + 0.14, 0.8);
          drum('s', bt + 0.01, 1.3); drum('s', bt + 0.11, 1.0); drum('s', bt + 0.24, 0.7);
          [2400, 1600, 1050, 700, 460, 300].forEach(function (f, i) {
            tone(f, bt + 0.02 + i * 0.045, 0.75, 0.15, 'saw', 0.25);
          });
          tone(55, bt + 0.5, 1.2, 0.20, 'tri', 0.55);           // rumble tail
          drum('h', bt + 0.4, 0.4); drum('h', bt + 0.7, 0.25);
          break;
        /* Chaos Control: the world stalls, then snaps somewhere else */
        case 'control':
          tone(2093, t, 0.30, 0.09, 'pulse12', 0.45);           // glass chime
          tone(3136, t + 0.02, 0.24, 0.06, 'pulse12', 0.5);
          [1568, 1318, 1046, 880, 698, 587].forEach(function (f, i) {
            tone(f, t + i * 0.05, 0.55, 0.11, 'pulse25', 0.5);  // descending fold
          });
          for (var vi = 0; vi < 6; vi++) {                       // wow-flutter
            tone(440 + vi * 40, t + 0.30 + vi * 0.04, 0.5, 0.07, 'tri', 2.2);
          }
          tone(880, t + 0.62, 0.5, 0.14, 'saw', 0.28);          // the snap back
          tone(1760, t + 0.62, 0.22, 0.10, 'pulse12', 0.3);
          drum('h', t + 0.62, 0.5);
          tone(90, t + 0.64, 0.5, 0.16, 'tri', 0.5);
          break;
        /* the sidearm */
        case 'gunshot':
          burst(t, { type: 'highpass', f0: 2600, f1: 700, q: 0.4, dur: 0.13, vol: 0.34 });
          tone(420, t, 0.09, 0.24, 'saw', 0.14);
          tone(1900, t, 0.035, 0.14, 'pulse12', 0.2);
          tone(88, t + 0.01, 0.22, 0.18, 'tri', 0.4);
          burst(t + 0.06, { type: 'lowpass', f0: 900, f1: 200, dur: 0.22, vol: 0.08 });
          break;
        case 'reload':  tone(700, t, 0.04, 0.09, 'pulse25'); tone(500, t + 0.07, 0.05, 0.09, 'pulse25'); break;
        case 'tip':     [880, 1175].forEach(function (f, i) { tone(f, t + i * 0.06, 0.12, 0.09, 'pulse25'); }); break;
        case 'text':    tone(1320, t, 0.02, 0.05, 'pulse12'); break;
      }
    }
  };
})(window.SH = window.SH || {});
