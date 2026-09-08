/* =====================================================================
   engine.js - screen, input, assets, scene stack, drawing helpers.

   The whole game renders into a 320x240 back buffer that is blown up by
   an integer factor with smoothing off, which is what gives the picture
   its 16-bit console look regardless of window size.
   ===================================================================== */
(function (SH) {
  'use strict';

  var W = 320, H = 240;
  SH.W = W;
  SH.H = H;

  /* ---------- screen ------------------------------------------------ */
  var canvas = null, ctx = null, scale = 3;

  function resize() {
    if (!canvas) return;
    var pad = 90;
    var s = Math.floor(Math.min((window.innerWidth - 16) / W,
                                (window.innerHeight - pad) / H));
    scale = Math.max(1, Math.min(s, 6));
    canvas.style.width = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
  }

  /* ---------- input -------------------------------------------------- */
  var KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'confirm', Enter: 'confirm', Space: 'confirm',
    KeyX: 'cancel', ShiftLeft: 'cancel', ShiftRight: 'cancel',
    KeyC: 'menu', Escape: 'menu',
    KeyF: 'fullscreen', KeyM: 'mute'
  };

  /* Presses are buffered rather than derived from a previous-frame
     snapshot: a very short tap can begin and end inside one frame, and
     an edge computed from snapshots alone would swallow it. */
  var Input = SH.Input = {
    state: {}, last: {}, buf: {}, relBuf: {}, anyPressed: false,
    down: function (k) { return !!this.state[k]; },
    pressed: function (k) { return !!this.buf[k]; },
    released: function (k) { return !!this.relBuf[k]; },
    axis: function () {
      return {
        x: (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0),
        y: (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0)
      };
    },
    endFrame: function () {
      this.last = {};
      for (var k in this.state) this.last[k] = this.state[k];
      this.buf = {};
      this.relBuf = {};
      this.anyPressed = false;
    },
    clear: function () {
      this.state = {}; this.last = {}; this.buf = {}; this.relBuf = {};
    }
  };

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      var a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (!Input.state[a]) { Input.anyPressed = true; Input.buf[a] = true; }
      Input.state[a] = true;
    });
    window.addEventListener('keyup', function (e) {
      var a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (Input.state[a]) Input.relBuf[a] = true;
      Input.state[a] = false;
    });
    window.addEventListener('blur', function () { Input.clear(); });
  }

  /* ---------- assets -------------------------------------------------- */
  var sheets = {};
  SH.Assets = {
    sheet: function (n) { return sheets[n]; },
    load: function (onProgress) {
      /* SH.SpriteOverrides (js/sprite_override.js, optional) replaces any
         generated sheet with the player's own artwork - see README. */
      var data = {};
      var k1;
      for (k1 in (SH.SpriteData || {})) data[k1] = SH.SpriteData[k1];
      for (k1 in (SH.SpriteOverrides || {})) {
        var ov = SH.SpriteOverrides[k1], base = data[k1] || {};
        data[k1] = {
          src: ov.src || base.src,
          fw: ov.fw || base.fw, fh: ov.fh || base.fh,
          cols: ov.cols || base.cols, frames: ov.frames || base.frames,
          names: ov.names || base.names
        };
      }
      var keys = Object.keys(data), done = 0;
      return Promise.all(keys.map(function (k) {
        return new Promise(function (res) {
          var d = data[k], img = new Image();
          img.onload = img.onerror = function () {
            sheets[k] = {
              img: img, fw: d.fw, fh: d.fh, cols: d.cols,
              frames: d.frames, names: d.names || {}
            };
            done++;
            if (onProgress) onProgress(done, keys.length);
            res();
          };
          img.src = d.src;
        });
      }));
    }
  };

  /* ---------- drawing helpers ----------------------------------------- */
  SH.clear = function (col) {
    ctx.fillStyle = col || '#000';
    ctx.fillRect(0, 0, W, H);
  };

  SH.rect = function (x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  };

  SH.frameRect = function (x, y, w, h, col, lw) {
    lw = lw || 1;
    ctx.fillStyle = col;
    ctx.fillRect(x | 0, y | 0, w | 0, lw);
    ctx.fillRect(x | 0, (y + h - lw) | 0, w | 0, lw);
    ctx.fillRect(x | 0, y | 0, lw, h | 0);
    ctx.fillRect((x + w - lw) | 0, y | 0, lw, h | 0);
  };

  /* Draw frame `f` of a sheet. Options: flip, scale, alpha, tint. */
  SH.draw = function (name, f, x, y, o) {
    var s = sheets[name];
    if (!s) return;
    o = o || {};
    f = f | 0;
    if (f < 0 || f >= s.frames) f = 0;
    var sx = (f % s.cols) * s.fw, sy = ((f / s.cols) | 0) * s.fh;
    var sc = o.scale || 1;
    var dw = s.fw * sc, dh = s.fh * sc;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (o.flip) { ctx.translate(dw, 0); ctx.scale(-1, 1); }
    ctx.drawImage(s.img, sx, sy, s.fw, s.fh, 0, 0, dw, dh);
    ctx.restore();
  };

  /* Draw centred on (x,y) - the anchor most actors want. */
  SH.drawC = function (name, f, x, y, o) {
    var s = sheets[name];
    if (!s) return;
    var sc = (o && o.scale) || 1;
    SH.draw(name, f, x - s.fw * sc / 2, y - s.fh * sc / 2, o);
  };

  /* Bottom-centre anchor - for actors standing on a floor line. */
  SH.drawFoot = function (name, f, x, y, o) {
    var s = sheets[name];
    if (!s) return;
    var sc = (o && o.scale) || 1;
    SH.draw(name, f, x - s.fw * sc / 2, y - s.fh * sc, o);
  };

  SH.frameOf = function (sheet, anim, i) {
    var s = sheets[sheet];
    if (!s || !s.names || !s.names[anim]) return 0;
    var list = s.names[anim];
    return list[((i | 0) % list.length + list.length) % list.length];
  };

  var FONT = '"Galmuri11","DungGeunMo","Apple SD Gothic Neo","Malgun Gothic",monospace';

  SH.text = function (str, x, y, o) {
    o = o || {};
    var size = o.size || 10;
    ctx.font = (o.bold ? 'bold ' : '') + size + 'px ' + FONT;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'top';
    if (o.shadow !== false) {
      ctx.fillStyle = o.shadowColor || '#000';
      ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
    }
    ctx.fillStyle = o.color || '#f2f2f8';
    ctx.fillText(str, Math.round(x), Math.round(y));
  };

  SH.textWidth = function (str, size) {
    ctx.font = (size || 10) + 'px ' + FONT;
    return ctx.measureText(str).width;
  };

  /* Word-wrap that also respects manual \n. */
  SH.wrap = function (str, maxw, size) {
    var out = [];
    String(str).split('\n').forEach(function (para) {
      var line = '';
      for (var i = 0; i < para.length; i++) {
        var t = line + para[i];
        if (SH.textWidth(t, size) > maxw && line) { out.push(line); line = para[i]; }
        else line = t;
      }
      out.push(line);
    });
    return out;
  };

  /* Undertale-style bordered panel. */
  SH.panel = function (x, y, w, h, o) {
    o = o || {};
    SH.rect(x, y, w, h, o.fill || '#000');
    SH.frameRect(x, y, w, h, o.border || '#f2f2f8', o.lw || 2);
  };

  SH.bar = function (x, y, w, h, pct, fill, back) {
    pct = Math.max(0, Math.min(1, pct));
    SH.rect(x, y, w, h, back || '#3a0d12');
    SH.rect(x, y, Math.round(w * pct), h, fill || '#d8232f');
  };

  /* ---------- randomness ---------------------------------------------- */
  SH.rand = function (a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + Math.random() * (b - a);
  };
  SH.randInt = function (a, b) { return Math.floor(SH.rand(a, b + 1)); };
  SH.choice = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  SH.chance = function (p) { return Math.random() < p; };
  SH.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  SH.lerp = function (a, b, t) { return a + (b - a) * t; };
  SH.approach = function (v, t, d) { return v < t ? Math.min(v + d, t) : Math.max(v - d, t); };

  /* ---------- camera shake + flash ------------------------------------ */
  var shakeAmt = 0, shakeT = 0, flashCol = null, flashT = 0, flashDur = 0;
  SH.shake = function (amt, time) { shakeAmt = Math.max(shakeAmt, amt); shakeT = Math.max(shakeT, time || 0.25); };
  SH.flash = function (col, time) { flashCol = col; flashT = flashDur = time || 0.2; };

  /* ---------- fade transition ------------------------------------------ */
  var fade = { on: false, a: 0, dir: 0, dur: 0.35, cb: null, holdCol: '#000' };
  SH.fadeOut = function (dur, cb, col) {
    fade.on = true; fade.dir = 1; fade.a = 0;
    fade.dur = dur || 0.35; fade.cb = cb || null;
    fade.holdCol = col || '#000';
  };
  SH.fadeIn = function (dur, cb, col) {
    fade.on = true; fade.dir = -1; fade.a = 1;
    fade.dur = dur || 0.35; fade.cb = cb || null;
    fade.holdCol = col || '#000';
  };
  SH.isFading = function () { return fade.on; };

  /* ---------- scene stack ---------------------------------------------- */
  var stack = [];
  SH.scenes = stack;
  SH.top = function () { return stack[stack.length - 1]; };

  SH.push = function (sc) {
    var cur = SH.top();
    if (cur && cur.pause) cur.pause();
    stack.push(sc);
    if (sc.enter) sc.enter();
    Input.clear();
  };
  SH.pop = function () {
    var sc = stack.pop();
    if (sc && sc.exit) sc.exit();
    var cur = SH.top();
    if (cur && cur.resume) cur.resume();
    Input.clear();
    return sc;
  };
  SH.replace = function (sc) {
    while (stack.length) { var s = stack.pop(); if (s.exit) s.exit(); }
    SH.push(sc);
  };

  /* ---------- main loop -------------------------------------------------- */
  var last = 0, acc = 0, running = false;
  SH.time = 0;

  function frame(ts) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    SH.time += dt;

    /* update */
    if (fade.on) {
      fade.a += fade.dir * (dt / fade.dur);
      if (fade.dir > 0 && fade.a >= 1) {
        fade.a = 1; fade.on = false;
        var cb = fade.cb; fade.cb = null; if (cb) cb();
      } else if (fade.dir < 0 && fade.a <= 0) {
        fade.a = 0; fade.on = false;
        var cb2 = fade.cb; fade.cb = null; if (cb2) cb2();
      }
    }
    if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeAmt = 0; }
    if (flashT > 0) flashT -= dt;

    var top = SH.top();
    /* scenes below the top may opt into background updates */
    for (var i = 0; i < stack.length - 1; i++) {
      if (stack[i].updateAlways) stack[i].updateAlways(dt);
    }
    if (top && top.update) top.update(dt);

    /* draw */
    ctx.save();
    if (shakeAmt > 0) {
      ctx.translate((Math.random() - 0.5) * shakeAmt * 2,
                    (Math.random() - 0.5) * shakeAmt * 2);
    }
    SH.clear('#000');
    for (var j = 0; j < stack.length; j++) {
      var sc = stack[j];
      if (j < stack.length - 1 && !sc.drawUnder) continue;
      if (sc.draw) sc.draw();
    }
    ctx.restore();

    if (flashT > 0 && flashCol) {
      ctx.save();
      ctx.globalAlpha = SH.clamp(flashT / flashDur, 0, 1) * 0.75;
      SH.rect(0, 0, W, H, flashCol);
      ctx.restore();
    }
    if (fade.a > 0) {
      ctx.save();
      ctx.globalAlpha = SH.clamp(fade.a, 0, 1);
      SH.rect(0, 0, W, H, fade.holdCol);
      ctx.restore();
    }

    /* global hotkeys */
    if (Input.pressed('fullscreen')) {
      var el = document.getElementById('frame');
      if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
      else if (document.exitFullscreen) document.exitFullscreen();
    }
    if (Input.pressed('mute') && SH.Audio) SH.Audio.toggleMute();

    Input.endFrame();
  }

  SH.boot = function (firstScene) {
    canvas = document.getElementById('screen');
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    SH.ctx = ctx;
    bindInput();
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', resize);
    SH.push(firstScene);
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
})(window.SH = window.SH || {});
