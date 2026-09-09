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

  /* ---- tracks -------------------------------------------------------- */
  function P(s) { return s.trim().split(/\s+/); }

  var TRACKS = {
    /* main title - slow, ominous, minor */
    title: { bpm: 96, ch: [
      { kind: 'pulse25', vol: 0.16, pat: P(
        'a3 - - . c4 - - . e4 - - . d4 - - - a3 - - . c4 - - . g4 - f4 - e4 - - -') },
      { kind: 'tri', vol: 0.20, pat: P(
        'a1 - a2 - a1 - a2 - f1 - f2 - f1 - f2 - g1 - g2 - g1 - g2 - e1 - e2 - e1 - e2 -') },
      { kind: 'noise', vol: 0.13, pat: P(
        'k . h . s . h . k . h . s . h . k . h . s . h . k . h k s . h .') }
    ]},
    /* Westopolis - driving city rock */
    city: { bpm: 148, ch: [
      { kind: 'pulse12', vol: 0.13, pat: P(
        'e4 . e4 g4 a4 . g4 e4 d4 . e4 . c4 . d4 . e4 . e4 g4 b4 . a4 g4 e4 . d4 . e4 . . .') },
      { kind: 'pulse', vol: 0.09, pat: P(
        'b3 . b3 d4 e4 . d4 b3 a3 . b3 . g3 . a3 . b3 . b3 d4 e4 . e4 d4 b3 . a3 . b3 . . .') },
      { kind: 'tri', vol: 0.22, pat: P(
        'e2 - e2 . e2 - e2 . c2 - c2 . c2 - c2 . g2 - g2 . g2 - g2 . a2 - a2 . b2 - b2 .') },
      { kind: 'noise', vol: 0.14, pat: P(
        'k h s h k h s h k h s h k h s k k h s h k h s h k h s h k s k s') }
    ]},
    /* Space Colony ARK - cold, spacious */
    ark: { bpm: 112, ch: [
      { kind: 'pulse25', vol: 0.12, pat: P(
        'd4 - . f4 - . a4 - - . g4 - f4 - - . c4 - . e4 - . g4 - - . f4 - e4 - - .') },
      { kind: 'tri', vol: 0.20, pat: P(
        'd2 - - - d2 - - - bb1 - - - bb1 - - - c2 - - - c2 - - - a1 - - - a1 - - -') },
      { kind: 'noise', vol: 0.08, pat: P(
        'h . . h . . h . h . . h . . h . h . . h . . h . h . . h . . h .') }
    ]},
    /* Black Comet - alien and dissonant */
    comet: { bpm: 128, ch: [
      { kind: 'saw', vol: 0.10, pat: P(
        'c4 . db4 . c4 . ab3 . g3 . ab3 . c4 . db4 . eb4 . d4 . c4 . ab3 . g3 . f3 . g3 .') },
      { kind: 'tri', vol: 0.22, pat: P(
        'c2 - c2 db2 c2 - c2 . ab1 - ab1 . g1 - g1 . c2 - c2 db2 c2 - c2 . f1 - f1 . g1 - g1 .') },
      { kind: 'noise', vol: 0.15, pat: P(
        'k . k s . k . s k . k s . k s . k . k s . k . s k s k s k s k s') }
    ]},
    /* random encounter */
    battle: { bpm: 168, ch: [
      { kind: 'pulse', vol: 0.14, pat: P(
        'a4 . a4 . c5 . b4 . a4 . g4 . e4 . g4 . a4 . a4 . c5 . e5 . d5 . c5 . b4 . a4 .') },
      { kind: 'pulse25', vol: 0.09, pat: P(
        'e4 . e4 . a4 . g4 . e4 . d4 . c4 . d4 . e4 . e4 . a4 . c5 . b4 . a4 . g4 . e4 .') },
      { kind: 'tri', vol: 0.23, pat: P(
        'a1 a1 . a1 a1 . a1 . f1 f1 . f1 f1 . f1 . g1 g1 . g1 g1 . g1 . e1 e1 . e1 e1 . e1 .') },
      { kind: 'noise', vol: 0.15, pat: P(
        'k h k h s h k h k h k h s h k s k h k h s h k h k h k h s k s k') }
    ]},
    /* named boss */
    boss: { bpm: 178, ch: [
      { kind: 'pulse12', vol: 0.15, pat: P(
        'd4 d4 . d4 f4 . d4 . g4 . f4 . e4 . d4 . d4 d4 . d4 f4 . a4 . g4 . f4 . e4 . d4 .') },
      { kind: 'saw', vol: 0.09, pat: P(
        'a3 a3 . a3 c4 . a3 . d4 . c4 . b3 . a3 . a3 a3 . a3 c4 . e4 . d4 . c4 . b3 . a3 .') },
      { kind: 'tri', vol: 0.26, pat: P(
        'd1 d1 d1 . d1 d1 d1 . bb0 bb0 bb0 . bb0 bb0 bb0 . c1 c1 c1 . c1 c1 c1 . a0 a0 a0 . a0 a0 a0 .') },
      { kind: 'noise', vol: 0.17, pat: P(
        'k k s h k k s h k k s h k s k s k k s h k k s h k s k s k s k s') }
    ]},
    /* Last Story - Super Shadow vs Devil Doom */
    last: { bpm: 190, ch: [
      { kind: 'pulse', vol: 0.16, pat: P(
        'e5 . d5 . c5 . b4 . c5 . d5 . e5 . g5 . e5 . d5 . c5 . b4 . a4 . b4 . c5 . e5 .') },
      { kind: 'pulse25', vol: 0.10, pat: P(
        'b4 . a4 . g4 . f#4 . g4 . a4 . b4 . d5 . b4 . a4 . g4 . f#4 . e4 . f#4 . g4 . b4 .') },
      { kind: 'tri', vol: 0.26, pat: P(
        'e1 e1 e1 e1 c1 c1 c1 c1 g1 g1 g1 g1 d1 d1 d1 d1 e1 e1 e1 e1 c1 c1 c1 c1 a0 a0 a0 a0 b0 b0 b0 b0') },
      { kind: 'noise', vol: 0.18, pat: P(
        'k h s h k h s h k h s h k s k s k h s h k h s h k h s k s k s k') }
    ]},
    /* endings */
    ending_dark: { bpm: 84, ch: [
      { kind: 'saw', vol: 0.13, pat: P(
        'd3 - - - f3 - - - ab3 - - - g3 - - - c3 - - - eb3 - - - d3 - - - - - - -') },
      { kind: 'tri', vol: 0.22, pat: P(
        'd1 - - - d1 - - - ab0 - - - ab0 - - - c1 - - - c1 - - - d1 - - - d1 - - -') }
    ]},
    ending_hero: { bpm: 100, ch: [
      { kind: 'pulse25', vol: 0.14, pat: P(
        'c4 - e4 - g4 - - . a4 - g4 - e4 - - . f4 - a4 - c5 - - . b4 - g4 - c4 - - -') },
      { kind: 'tri', vol: 0.20, pat: P(
        'c2 - g1 - c2 - g1 - a1 - e1 - a1 - e1 - f1 - c2 - f1 - c2 - g1 - d2 - g1 - - -') }
    ]},
    ending_true: { bpm: 92, ch: [
      { kind: 'tri', vol: 0.20, pat: P(
        'a2 - c3 - e3 - a3 - g3 - e3 - c3 - a2 - f2 - a2 - c3 - f3 - e3 - c3 - a2 - - -') },
      { kind: 'pulse25', vol: 0.11, pat: P(
        'a4 - - - g4 - - - e4 - - - c4 - - - d4 - - - e4 - - - a3 - - - - - - -') }
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
        case 'hit':     drum('s', t, 0.5); tone(160, t, 0.16, 0.20, 'saw', 0.4); break;
        case 'slash':   tone(1400, t, 0.10, 0.16, 'saw', 0.25); drum('h', t, 0.4); break;
        case 'hurt':    tone(220, t, 0.28, 0.22, 'saw', 0.35); drum('s', t, 0.6); break;
        case 'spare':   [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.07, 0.18, 0.13, 'pulse25'); }); break;
        case 'kill':    tone(90, t, 0.5, 0.26, 'saw', 0.25); drum('k', t, 0.9); break;
        case 'graze':   tone(1760, t, 0.04, 0.06, 'pulse12'); break;
        case 'pickup':  [784, 1047, 1319].forEach(function (f, i) { tone(f, t + i * 0.05, 0.12, 0.12, 'pulse'); }); break;
        case 'heal':    [523, 784].forEach(function (f, i) { tone(f, t + i * 0.09, 0.22, 0.11, 'tri'); }); break;
        case 'unlock':  [392, 523, 659, 880].forEach(function (f, i) { tone(f, t + i * 0.08, 0.2, 0.13, 'pulse25'); }); break;
        case 'deny':    tone(180, t, 0.16, 0.15, 'saw'); tone(140, t + 0.1, 0.16, 0.15, 'saw'); break;
        case 'encounter': tone(1200, t, 0.08, 0.16, 'pulse12'); tone(900, t + 0.09, 0.08, 0.16, 'pulse12'); tone(600, t + 0.18, 0.22, 0.18, 'saw', 0.4); break;
        /* Chaos Spear: a rising charge that snaps into a hard discharge */
        case 'chaos':
          [180, 300, 520, 900, 1500].forEach(function (f, i) {
            tone(f, t + i * 0.035, 0.22, 0.15, 'saw', 0.75);
          });
          tone(2400, t + 0.16, 0.16, 0.20, 'pulse12', 0.18);
          tone(120, t + 0.16, 0.36, 0.24, 'saw', 0.4);
          drum('s', t + 0.16, 0.7);
          break;
        /* Chaos Blast: detonation - sub drop, noise burst, ringing tail */
        case 'blast':
          tone(90, t, 0.9, 0.30, 'saw', 0.22);
          tone(160, t, 0.7, 0.24, 'tri', 0.25);
          drum('k', t, 1.3); drum('k', t + 0.05, 1.0);
          drum('s', t + 0.02, 1.1); drum('s', t + 0.14, 0.8);
          [1800, 1200, 760, 440].forEach(function (f, i) {
            tone(f, t + 0.02 + i * 0.05, 0.5, 0.16, 'saw', 0.3);
          });
          tone(60, t + 0.3, 0.8, 0.18, 'tri', 0.5);
          break;
        /* Chaos Control: time folding - a shimmer that bends downward */
        case 'control':
          [1568, 1318, 1046, 880, 698].forEach(function (f, i) {
            tone(f, t + i * 0.055, 0.5, 0.11, 'pulse25', 0.55);
          });
          tone(440, t + 0.28, 0.7, 0.13, 'tri', 1.6);
          tone(2093, t, 0.25, 0.07, 'pulse12', 0.5);
          break;
        /* the sidearm */
        case 'gunshot':
          drum('s', t, 1.0);
          tone(320, t, 0.10, 0.24, 'saw', 0.18);
          tone(1500, t, 0.05, 0.16, 'pulse12', 0.25);
          tone(90, t + 0.02, 0.20, 0.16, 'tri', 0.4);
          break;
        case 'reload':  tone(700, t, 0.04, 0.09, 'pulse25'); tone(500, t + 0.07, 0.05, 0.09, 'pulse25'); break;
        case 'tip':     [880, 1175].forEach(function (f, i) { tone(f, t + i * 0.06, 0.12, 0.09, 'pulse25'); }); break;
        case 'text':    tone(1320, t, 0.02, 0.05, 'pulse12'); break;
      }
    }
  };
})(window.SH = window.SH || {});
