/* =====================================================================
   dialogue.js - Undertale-style typewriter textbox + reusable menus.
   ===================================================================== */
(function (SH) {
  'use strict';

  /* A line is either a plain string or
     { who:'섀도우', face:'face_shadow', frame:0, text:'...', color:'#fff' } */
  function Textbox(lines, opt) {
    opt = opt || {};
    this.lines = (lines || []).map(function (l) {
      return typeof l === 'string' ? { text: l } : l;
    });
    this.i = 0;
    this.chars = 0;
    this.speed = opt.speed || 42;          // characters per second
    this.x = opt.x !== undefined ? opt.x : 10;
    this.y = opt.y !== undefined ? opt.y : 158;
    this.w = opt.w || (SH.W - 20);
    this.h = opt.h || 72;
    this.done = false;
    this.onDone = opt.onDone || null;
    this.blip = 0;
    this.autoClose = opt.autoClose !== false;
    this._prepare();
  }

  Textbox.prototype._prepare = function () {
    var l = this.lines[this.i] || { text: '' };
    var pad = l.face ? 44 : 12;
    this.rows = SH.wrap(l.text || '', this.w - pad - 12, 10);
    this.total = this.rows.join('\n').length;
    this.chars = 0;
  };

  Textbox.prototype.finishedTyping = function () {
    return this.chars >= this.total;
  };

  Textbox.prototype.skip = function () { this.chars = this.total; };

  Textbox.prototype.advance = function () {
    if (!this.finishedTyping()) { this.skip(); return; }
    this.i++;
    if (this.i >= this.lines.length) {
      this.done = true;
      if (this.onDone) this.onDone();
    } else {
      this._prepare();
      SH.Audio.sfx('confirm');
    }
  };

  Textbox.prototype.update = function (dt) {
    if (this.done) return;
    if (!this.finishedTyping()) {
      var before = this.chars | 0;
      this.chars = Math.min(this.total, this.chars + this.speed * dt);
      if ((this.chars | 0) > before) {
        this.blip = (this.blip + 1) % 3;
        if (this.blip === 0) SH.Audio.sfx('text');
      }
    }
    if (SH.Input.pressed('confirm') || SH.Input.pressed('cancel')) this.advance();
  };

  Textbox.prototype.draw = function () {
    if (this.done) return;
    var l = this.lines[this.i] || { text: '' };
    SH.panel(this.x, this.y, this.w, this.h, { fill: '#000', border: '#f2f2f8', lw: 2 });

    var tx = this.x + 12;
    if (l.face) {
      SH.rect(this.x + 6, this.y + 6, 34, 34, '#14141f');
      SH.frameRect(this.x + 6, this.y + 6, 34, 34, '#4a4a68', 1);
      SH.draw(l.face, l.frame || 0, this.x + 7, this.y + 7, {});
      tx = this.x + 48;
    }
    var ty = this.y + 9;
    if (l.who) {
      SH.text(l.who, tx, ty, { color: l.color || '#ffd23f', size: 10, bold: true });
      ty += 14;
    }
    /* reveal characters across the wrapped rows */
    var budget = this.chars | 0;
    for (var r = 0; r < this.rows.length; r++) {
      var row = this.rows[r];
      var take = Math.max(0, Math.min(row.length, budget));
      if (take > 0) {
        SH.text(row.slice(0, take), tx, ty + r * 13,
                { color: l.color || '#f2f2f8', size: 10 });
      }
      budget -= row.length;
      if (budget <= 0) break;
    }
    if (this.finishedTyping()) {
      var b = (Math.sin(SH.time * 6) > 0) ? 1 : 0;
      SH.text('▼', this.x + this.w - 16, this.y + this.h - 16 + b,
              { color: '#ffd23f', size: 9 });
    }
  };

  /* ------------------------------------------------------------------ */
  /* A vertical selection list with an animated soul cursor.             */
  function Menu(items, opt) {
    opt = opt || {};
    this.items = items;            // [{label, desc, enabled, value}]
    this.i = 0;
    this.x = opt.x || 40;
    this.y = opt.y || 100;
    this.lh = opt.lh || 16;
    this.size = opt.size || 11;
    this.cursor = opt.cursor !== false;
    this.columns = opt.columns || 1;
    this.width = opt.width || 120;
    this.wrapAround = opt.wrapAround !== false;
  }

  Menu.prototype.move = function (d) {
    var n = this.items.length;
    var start = this.i;
    do {
      this.i += d;
      if (this.i < 0) this.i = this.wrapAround ? n - 1 : 0;
      if (this.i >= n) this.i = this.wrapAround ? 0 : n - 1;
      if (this.i === start) break;
    } while (this.items[this.i] && this.items[this.i].enabled === false);
    if (this.i !== start) SH.Audio.sfx('move');
  };

  /* Returns the chosen item when confirmed, else null. */
  Menu.prototype.update = function () {
    var rows = Math.ceil(this.items.length / this.columns);
    if (this.columns > 1) {
      if (SH.Input.pressed('down')) this.move(1);
      if (SH.Input.pressed('up')) this.move(-1);
      if (SH.Input.pressed('right')) this.move(rows);
      if (SH.Input.pressed('left')) this.move(-rows);
    } else {
      if (SH.Input.pressed('down')) this.move(1);
      if (SH.Input.pressed('up')) this.move(-1);
    }
    if (SH.Input.pressed('confirm')) {
      var it = this.items[this.i];
      if (it && it.enabled === false) { SH.Audio.sfx('deny'); return null; }
      SH.Audio.sfx('confirm');
      return it;
    }
    return null;
  };

  Menu.prototype.draw = function () {
    var rows = Math.ceil(this.items.length / this.columns);
    for (var k = 0; k < this.items.length; k++) {
      var it = this.items[k];
      var col = Math.floor(k / rows), row = k % rows;
      var x = this.x + col * this.width, y = this.y + row * this.lh;
      var on = (k === this.i);
      var color = it.enabled === false ? '#55556b'
                : (on ? '#ffd23f' : (it.color || '#e2e2ec'));
      SH.text(it.label, x + 14, y, { color: color, size: this.size });
      if (on && this.cursor) {
        SH.draw('hud', SH.frameOf('hud', 'soul', 0), x - 4, y - 3, { alpha: 1 });
      }
    }
    var sel = this.items[this.i];
    if (sel && sel.desc) {
      SH.text(sel.desc, SH.W / 2, SH.H - 22,
              { color: '#9b9bb4', size: 9, align: 'center' });
    }
  };

  SH.Textbox = Textbox;
  SH.Menu = Menu;
})(window.SH = window.SH || {});
