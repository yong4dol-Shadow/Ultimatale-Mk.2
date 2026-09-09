/* =====================================================================
   combat.js - turn-based battle.

   Presentation follows DELTARUNE: a side view with Shadow standing on
   the left facing right and the enemy line-up on the right facing left,
   an action bar of FIGHT / ACT / ITEM / MERCY along the bottom, and a
   swinging attack meter for FIGHT.

   Resolution follows UNDERTALE: every enemy can be killed or talked
   down, ACT choices raise mercy until SPARE lights up, and the enemy's
   turn drops you into a bullet box where you dodge with the red soul.
   ===================================================================== */
(function (SH) {
  'use strict';

  var GROUND = 124;
  var BOX = { x: 60, y: 130, w: 200, h: 82 };
  var BTN = [
    { key: 'FIGHT', label: 'FIGHT', icon: 'icon_fight', color: '#ff5a5a' },
    { key: 'ACT',   label: 'ACT',   icon: 'icon_act',   color: '#ffd23f' },
    { key: 'ITEM',  label: 'ITEM',  icon: 'icon_item',  color: '#7fdcff' },
    { key: 'MERCY', label: 'MERCY', icon: 'icon_mercy', color: '#7dff9b' }
  ];

  /* ==================================================================
     bullet patterns
     Each pattern gets the battle as `b` and pushes bullets through
     b.spawn().  b.pt is the seconds elapsed inside the pattern.
     ================================================================== */
  function bullet(o) {
    return {
      x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0,
      w: o.w || 8, h: o.h || 8,
      spr: o.spr || 'p_bullet', frame: o.frame || 0,
      rot: o.rot || 0, spin: o.spin || 0,
      dmg: o.dmg || 0, life: o.life === undefined ? 6 : o.life,
      grazed: false, warn: o.warn || 0, tick: 0,
      accel: o.accel || 0, home: o.home || 0, sine: o.sine || 0,
      sinePhase: o.sinePhase || 0, baseX: o.x, baseY: o.y,
      onDie: o.onDie || null, wobble: o.wobble || 0
    };
  }

  var P = SH.Patterns = {

    /* --- G.U.N. ---------------------------------------------------- */
    gunLine: { dur: 5.2, every: 0.42, step: function (b) {
      var y = b.soul.y + SH.rand(-16, 16);
      b.spawn(bullet({ x: BOX.x + BOX.w + 8, y: SH.clamp(y, BOX.y + 8, BOX.y + BOX.h - 8),
                       vx: -125, w: 10, h: 6, spr: 'p_gun', dmg: b.atk, warn: 0.35 }));
    }},

    gunSpread: { dur: 5.0, every: 0.75, step: function (b) {
      var ox = BOX.x + BOX.w - 6, oy = SH.rand(BOX.y + 14, BOX.y + BOX.h - 14);
      for (var i = -2; i <= 2; i++) {
        b.spawn(bullet({ x: ox, y: oy, vx: -110, vy: i * 26, w: 10, h: 6,
                         spr: 'p_gun', dmg: b.atk }));
      }
    }},

    beetleLaser: { dur: 5.0, every: 0.9, step: function (b) {
      var x = SH.rand(BOX.x + 16, BOX.x + BOX.w - 16);
      b.spawn(bullet({ x: x, y: BOX.y - 6, vy: 150, w: 6, h: 16,
                       spr: 'p_bullet', dmg: b.atk, warn: 0.5, wobble: 0 }));
      b.spawn(bullet({ x: x + 40 > BOX.x + BOX.w - 10 ? x - 40 : x + 40, y: BOX.y - 6,
                       vy: 150, w: 6, h: 16, spr: 'p_bullet', dmg: b.atk, warn: 0.5 }));
    }},

    homing: { dur: 5.4, every: 1.15, step: function (b) {
      b.spawn(bullet({ x: BOX.x + BOX.w - 10, y: SH.rand(BOX.y + 12, BOX.y + BOX.h - 12),
                       vx: -22, vy: 0, w: 9, h: 9, spr: 'p_orb', home: 34,
                       dmg: b.atk, life: 5.5, warn: 0.3 }));
    }},

    hunterMissiles: { dur: 5.6, every: 0.5, step: function (b) {
      var x = SH.rand(BOX.x + 10, BOX.x + BOX.w - 10);
      b.spawn(bullet({ x: x, y: BOX.y - 8, vy: 40, accel: 150, w: 8, h: 10,
                       spr: 'p_orb', dmg: b.atk, warn: 0.45 }));
    }},

    hunterSweep: { dur: 5.4, every: 0.14, step: function (b) {
      var a = b.pt * 2.1;
      var cx = BOX.x + BOX.w / 2, cy = BOX.y + BOX.h / 2;
      for (var k = 0; k < 2; k++) {
        var ang = a + k * Math.PI;
        b.spawn(bullet({ x: cx, y: cy, vx: Math.cos(ang) * 92, vy: Math.sin(ang) * 92,
                         w: 7, h: 7, dmg: b.atk, life: 3 }));
      }
    }},

    /* --- Black Arms -------------------------------------------------- */
    clawArc: { dur: 5.0, every: 0.62, step: function (b) {
      var y0 = SH.rand(BOX.y + 12, BOX.y + BOX.h - 12);
      for (var i = 0; i < 3; i++) {
        b.spawn(bullet({ x: BOX.x + BOX.w + 10 + i * 14, y: y0 + i * 9,
                         vx: -140, vy: -14, w: 12, h: 8, spr: 'p_blade',
                         spin: 6, dmg: b.atk, warn: 0.3 }));
      }
    }},

    orbRain: { dur: 5.4, every: 0.32, step: function (b) {
      b.spawn(bullet({ x: SH.rand(BOX.x + 8, BOX.x + BOX.w - 8), y: BOX.y - 8,
                       vy: SH.rand(70, 115), w: 10, h: 10, spr: 'p_orb',
                       sine: SH.rand(10, 26), sinePhase: SH.rand(0, 6.28),
                       dmg: b.atk }));
    }},

    hawkDive: { dur: 5.0, every: 0.55, step: function (b) {
      var fromTop = SH.chance(0.5);
      var x = BOX.x + BOX.w + 10;
      var y = fromTop ? BOX.y - 6 : BOX.y + BOX.h + 6;
      var tx = b.soul.x, ty = b.soul.y;
      var dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
      b.spawn(bullet({ x: x, y: y, vx: dx / d * 165, vy: dy / d * 165,
                       w: 9, h: 6, spr: 'p_blade', dmg: b.atk, warn: 0.28 }));
    }},

    featherSpread: { dur: 5.0, every: 1.25, step: function (b) {
      var cx = SH.rand(BOX.x + 30, BOX.x + BOX.w - 30);
      var cy = SH.rand(BOX.y + 20, BOX.y + BOX.h - 20);
      for (var i = 0; i < 10; i++) {
        var a = (i / 10) * Math.PI * 2 + b.pt;
        b.spawn(bullet({ x: cx, y: cy, vx: Math.cos(a) * 76, vy: Math.sin(a) * 76,
                         w: 7, h: 7, dmg: b.atk, life: 3.2, warn: 0.3 }));
      }
    }},

    oakSlam: { dur: 5.4, every: 1.0, step: function (b) {
      SH.shake(3, 0.2);
      for (var i = 0; i < 7; i++) {
        b.spawn(bullet({ x: BOX.x + 12 + i * 28, y: BOX.y + BOX.h + 6,
                         vy: -SH.rand(90, 125), w: 10, h: 10, spr: 'p_orb',
                         accel: 60, dmg: b.atk, warn: 0.4 }));
      }
    }},

    /* --- Sonic's crew ------------------------------------------------ */
    sonicSpin: { dur: 5.4, every: 1.6, step: function (b) {
      var bl = bullet({ x: BOX.x + 20, y: BOX.y + 20, vx: 132, vy: 96,
                        w: 13, h: 13, spr: 'p_orb', spin: 12, dmg: b.atk, life: 5 });
      bl.bounce = true;
      b.spawn(bl);
    }},

    sonicDash: { dur: 5.2, every: 0.7, step: function (b) {
      var y = SH.clamp(b.soul.y + SH.rand(-10, 10), BOX.y + 8, BOX.y + BOX.h - 8);
      b.spawn(bullet({ x: BOX.x + BOX.w + 14, y: y, vx: -235, w: 16, h: 8,
                       spr: 'p_spear', dmg: b.atk, warn: 0.55 }));
    }},

    tailsBombs: { dur: 5.2, every: 0.95, step: function (b) {
      var tx = SH.rand(BOX.x + 20, BOX.x + BOX.w - 20);
      var bl = bullet({ x: BOX.x + BOX.w + 6, y: BOX.y + 6,
                        vx: (tx - (BOX.x + BOX.w + 6)) / 1.1, vy: 20, accel: 90,
                        w: 10, h: 10, spr: 'p_orb', dmg: b.atk, life: 1.15 });
      bl.onDie = function (bb, ctx) {
        for (var i = 0; i < 6; i++) {
          var a = (i / 6) * Math.PI * 2;
          ctx.spawn(bullet({ x: bb.x, y: bb.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70,
                             w: 6, h: 6, dmg: ctx.atk, life: 1.6 }));
        }
      };
      b.spawn(bl);
    }},

    /* --- bosses ------------------------------------------------------- */
    doomEyes: { dur: 6.2, every: 1.25, step: function (b) {
      var ex = SH.rand(BOX.x + 24, BOX.x + BOX.w - 24);
      var ey = SH.rand(BOX.y + 14, BOX.y + BOX.h - 14);
      var eye = bullet({ x: ex, y: ey, w: 12, h: 10, spr: 'p_eye', dmg: 0,
                         life: 1.0, warn: 0.9 });
      eye.harmless = true;
      eye.onDie = function (bb, ctx) {
        var dx = ctx.soul.x - bb.x, dy = ctx.soul.y - bb.y, d = Math.hypot(dx, dy) || 1;
        for (var i = -1; i <= 1; i++) {
          var a = Math.atan2(dy, dx) + i * 0.22;
          ctx.spawn(bullet({ x: bb.x, y: bb.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
                             w: 7, h: 7, spr: 'p_bullet', dmg: ctx.atk, life: 2.6 }));
        }
      };
      b.spawn(eye);
    }},

    doomLaserGrid: { dur: 6.0, every: 1.5, step: function (b) {
      var gap = SH.randInt(0, 4);
      for (var i = 0; i < 5; i++) {
        if (i === gap) continue;
        b.spawn(bullet({ x: BOX.x + BOX.w + 10, y: BOX.y + 10 + i * 15,
                         vx: -120, w: 16, h: 6, spr: 'p_laser',
                         dmg: b.atk, warn: 0.6 }));
      }
    }},

    devilEyeBeam: { dur: 6.4, every: 0.1, step: function (b) {
      var a = Math.sin(b.pt * 1.15) * 1.1;
      var cx = BOX.x + BOX.w + 6, cy = BOX.y + BOX.h / 2;
      b.spawn(bullet({ x: cx, y: cy, vx: -Math.cos(a) * 160, vy: Math.sin(a) * 160,
                       w: 8, h: 8, spr: 'p_bullet', dmg: b.atk, life: 3 }));
    }},

    devilMeteor: { dur: 6.4, every: 0.26, step: function (b) {
      b.spawn(bullet({ x: SH.rand(BOX.x + 6, BOX.x + BOX.w - 6), y: BOX.y - 10,
                       vy: SH.rand(85, 150), vx: SH.rand(-18, 18),
                       w: 11, h: 11, spr: 'p_orb', dmg: b.atk, warn: 0.25 }));
      if (SH.chance(0.25)) {
        b.spawn(bullet({ x: BOX.x + BOX.w + 8, y: b.soul.y, vx: -190,
                         w: 16, h: 6, spr: 'p_laser', dmg: b.atk, warn: 0.4 }));
      }
    }},

    devilVortex: { dur: 6.6, every: 0.09, step: function (b) {
      var cx = BOX.x + BOX.w / 2, cy = BOX.y + BOX.h / 2;
      for (var k = 0; k < 2; k++) {
        var a = b.pt * 3.4 + k * Math.PI;
        b.spawn(bullet({ x: cx + Math.cos(a) * 12, y: cy + Math.sin(a) * 12,
                         vx: Math.cos(a) * 105, vy: Math.sin(a) * 105,
                         w: 7, h: 7, spr: 'p_bullet', dmg: b.atk, life: 3.4 }));
      }
    }}
  };

  /* ==================================================================
     Battle scene
     ================================================================== */
  function Battle(enemyIds, opt) {
    opt = opt || {};
    this.opt = opt;
    this.onEnd = opt.onEnd || function () {};
    this.isBoss = !!opt.boss;
    this.bgm = opt.bgm || (this.isBoss ? 'boss' : 'battle');
    this.superForm = !!opt.superForm;

    var xs = { 1: [232], 2: [206, 268], 3: [194, 240, 288] }[enemyIds.length] || [232];
    this.enemies = enemyIds.map(function (id, i) {
      var d = SH.Enemies[id];
      return {
        def: d, id: id, name: d.name, sheet: d.sheet,
        hp: d.hp, maxhp: d.hp, atk: d.atk, def_: d.def,
        mercy: 0, spared: false, dead: false, alive: true,
        x: xs[i] || 232, y: GROUND, hover: d.hover || 0,
        anim: 0, flash: 0, shakeT: 0,
        usedActs: {}, sayTimer: 0, say: ''
      };
    });

    this.state = 'intro';
    this.btn = 0;
    this.target = 0;
    this.menu = null;
    this.msg = null;
    this.turn = 0;
    this.result = null;
    this.bullets = [];
    this.fx = [];
    this.soul = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2, iframe: 0 };
    this.box = { x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h };
    this.pt = 0;
    this.pattern = null;
    this.patternClock = 0;
    this.chaosFrozen = 0;
    this.anim = 0;
    this.shadowPose = 'idle';
    this.poseTimer = 0;
    this.bar = null;
    this.kills = [];
    this.spares = [];
    this.flee = 0;
    this.introT = 0;
  }

  /* ---------- helpers ------------------------------------------------- */
  Battle.prototype.G = function () { return SH.Game; };

  Battle.prototype.living = function () {
    return this.enemies.filter(function (e) { return e.alive; });
  };

  Battle.prototype.firstLivingIndex = function () {
    for (var i = 0; i < this.enemies.length; i++) if (this.enemies[i].alive) return i;
    return 0;
  };

  Battle.prototype.isSpareable = function (e) {
    var s = e.def.spare || {};
    if (e.def.noSpare) return false;
    if (s.mercy !== undefined && e.mercy >= s.mercy) return true;
    if (s.hpBelow !== undefined && e.hp / e.maxhp <= s.hpBelow) return true;
    return false;
  };

  Battle.prototype.say = function (lines, next, opts) {
    var self = this;
    this.state = 'message';
    this.msg = new SH.Textbox(lines, Object.assign({
      x: 8, y: 130, w: 304, h: 82,
      onDone: function () { self.msg = null; if (next) next(); }
    }, opts || {}));
  };

  Battle.prototype.setPose = function (p, t) {
    this.shadowPose = p;
    this.poseTimer = t || 0.5;
  };

  Battle.prototype.addFx = function (sheet, x, y, frames, dur) {
    this.fx.push({ sheet: sheet, x: x, y: y, n: frames, t: 0, dur: dur || 0.3 });
  };

  /* ---------- scene lifecycle ------------------------------------------ */
  Battle.prototype.enter = function () {
    SH.Audio.play(this.bgm);
    SH.Story.recordBattle();
    var names = this.enemies.map(function (e) { return e.name; }).join(', ');
    var self = this;
    this.say([{ text: names + ' 이(가) 앞을 막아섰다!' }], function () { self.beginPlayerTurn(); });
  };

  Battle.prototype.beginPlayerTurn = function () {
    this.turn++;
    this.state = 'menu';
    this.btn = 0;
    this.bullets.length = 0;
    var alive = this.living();
    if (!alive.length) return this.finish('win');
    var e = SH.choice(alive);
    e.say = SH.choice(e.def.flavor);
    this.flavor = e.say;
  };

  Battle.prototype.finish = function (outcome) {
    if (this.result) return;
    this.result = outcome;
    var self = this, G = this.G();

    if (outcome === 'win' || outcome === 'spare' || outcome === 'flee') {
      var exp = 0, rings = 0;
      this.enemies.forEach(function (e) {
        if (e.dead) { exp += e.def.exp; rings += e.def.rings; }
        else if (e.spared) { rings += Math.floor(e.def.rings * 0.6); }
      });
      var lines = [];
      if (outcome === 'flee') {
        lines.push({ text: '카오스 컨트롤. 전장을 벗어났다.' });
      } else {
        lines.push({ text: (outcome === 'spare' ? '전투를 피했다. ' : '적을 제압했다. ') +
                           'EXP ' + exp + ' 획득, 링 ' + rings + '개 획득.' });
      }
      if (G) {
        G.exp += exp; G.rings += rings;
        var up = G.checkLevel();
        if (up) lines.push({ text: 'LOVE 가 ' + G.lv + ' 이(가) 되었다.' });
      }
      this.say(lines, function () { self.close(outcome); });
    } else {
      this.say([{ text: '섀도우가 쓰러졌다...' }], function () { self.close(outcome); });
    }
  };

  Battle.prototype.close = function (outcome) {
    var self = this;
    SH.fadeOut(0.3, function () {
      SH.pop();
      self.onEnd({
        outcome: outcome, kills: self.kills, spares: self.spares,
        enemies: self.enemies.map(function (e) {
          return { id: e.id, faction: e.def.faction, dead: e.dead, spared: e.spared };
        })
      });
      SH.fadeIn(0.3);
    });
  };

  /* ---------- damage ---------------------------------------------------- */
  Battle.prototype.hitEnemy = function (e, dmg) {
    e.hp -= dmg;
    e.flash = 0.35;
    e.shakeT = 0.3;
    this.addFx('fx_slash', e.x, e.y - 22, 3, 0.24);
    SH.shake(4, 0.18);
    if (e.hp <= 0) {
      e.hp = 0;
      e.alive = false;
      e.dead = true;
      this.kills.push(e.id);
      SH.Story.recordKill(e.def.faction);
      SH.Audio.sfx('kill');
      this.addFx('fx_boom', e.x, e.y - 22, 4, 0.4);
    } else {
      SH.Audio.sfx('hit');
    }
  };

  Battle.prototype.hurtPlayer = function (dmg) {
    var G = this.G();
    if (!G || this.soul.iframe > 0) return;
    dmg = Math.max(1, dmg - Math.floor(G.def / 2));
    G.hp -= dmg;
    this.soul.iframe = 1.0;
    SH.Audio.sfx('hurt');
    SH.shake(5, 0.25);
    SH.flash('#d8232f', 0.16);
    this.dmgPop = { v: dmg, t: 0.8 };
    if (G.hp <= 0) { G.hp = 0; this.endEnemyTurn(true); }
  };

  /* ---------- enemy turn ------------------------------------------------ */
  Battle.prototype.startEnemyTurn = function () {
    var alive = this.living();
    if (!alive.length) return this.finish('win');
    this.state = 'enemyturn';
    this.bullets.length = 0;
    var src = SH.choice(alive);
    this.patternOwner = src;
    var name = SH.choice(src.def.patterns);
    this.pattern = P[name] || P.orbRain;
    this.patternName = name;
    this.pt = 0;
    this.patternClock = 0;
    this.atk = src.atk;
    this.soul.x = this.box.x + this.box.w / 2;
    this.soul.y = this.box.y + this.box.h / 2;
    this.soul.iframe = 0.4;
    this.enemyLine = SH.choice(src.def.says);
    src.anim = 2;
  };

  Battle.prototype.endEnemyTurn = function (dead) {
    this.bullets.length = 0;
    this.enemies.forEach(function (e) { e.anim = 0; });
    if (dead) return this.finish('lose');
    var G = this.G();
    if (G && G.hp <= 0) return this.finish('lose');
    this.beginPlayerTurn();
  };

  Battle.prototype.spawn = function (b) { this.bullets.push(b); };

  Battle.prototype.updateBullets = function (dt) {
    var self = this, box = this.box, soul = this.soul;
    var frozen = this.chaosFrozen > 0;
    for (var i = this.bullets.length - 1; i >= 0; i--) {
      var b = this.bullets[i];
      b.tick += dt;
      if (b.warn > 0 && b.tick < b.warn) continue;      // telegraph pause
      if (!frozen) {
        if (b.accel) {
          var sp = Math.hypot(b.vx, b.vy) || 1;
          b.vx += (b.vx / sp) * b.accel * dt;
          b.vy += (b.vy / sp) * b.accel * dt;
        }
        if (b.home) {
          var dx = soul.x - b.x, dy = soul.y - b.y, d = Math.hypot(dx, dy) || 1;
          b.vx += dx / d * b.home * dt * 8;
          b.vy += dy / d * b.home * dt * 8;
          var s2 = Math.hypot(b.vx, b.vy);
          if (s2 > 78) { b.vx *= 78 / s2; b.vy *= 78 / s2; }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.sine) b.x += Math.sin(b.tick * 4 + b.sinePhase) * b.sine * dt;
        b.rot += b.spin * dt;
        if (b.bounce) {
          if (b.x < box.x + 6) { b.x = box.x + 6; b.vx = Math.abs(b.vx); }
          if (b.x > box.x + box.w - 6) { b.x = box.x + box.w - 6; b.vx = -Math.abs(b.vx); }
          if (b.y < box.y + 6) { b.y = box.y + 6; b.vy = Math.abs(b.vy); }
          if (b.y > box.y + box.h - 6) { b.y = box.y + box.h - 6; b.vy = -Math.abs(b.vy); }
        }
        b.life -= dt;
      }

      /* graze: near miss charges TP, exactly like Deltarune's TP bar */
      var ddx = Math.abs(b.x - soul.x), ddy = Math.abs(b.y - soul.y);
      var near = ddx < b.w / 2 + 12 && ddy < b.h / 2 + 12;
      var hit = ddx < b.w / 2 + 3 && ddy < b.h / 2 + 3;
      if (near && !hit) {
        var G = this.G();
        if (G) G.tp = Math.min(G.maxtp, G.tp + 22 * dt);
        if (!b.grazed) { b.grazed = true; SH.Audio.sfx('graze'); this.addFx('hud', b.x, b.y, 1, 0.2); }
      }
      if (hit && !b.harmless && b.dmg > 0) this.hurtPlayer(b.dmg);

      var out = b.x < box.x - 40 || b.x > box.x + box.w + 40 ||
                b.y < box.y - 40 || b.y > box.y + box.h + 40;
      if (b.life <= 0 || out) {
        if (b.onDie && b.life <= 0) b.onDie(b, this);
        this.bullets.splice(i, 1);
      }
    }
  };

  /* ---------- player actions ------------------------------------------- */
  Battle.prototype.openTarget = function (after) {
    var self = this;
    var items = this.enemies.map(function (e, i) {
      return {
        label: (self.isSpareable(e) ? '* ' : '  ') + e.name +
               '   ' + Math.max(0, Math.round(e.hp / e.maxhp * 100)) + '%',
        color: e.alive ? (self.isSpareable(e) ? '#ffd23f' : '#e2e2ec') : '#55556b',
        enabled: e.alive, value: i
      };
    });
    this.menu = new SH.Menu(items, { x: 76, y: 146, lh: 16, size: 11 });
    this.menu.i = this.firstLivingIndex();
    this.state = 'target';
    this.afterTarget = after;
  };

  Battle.prototype.openActs = function (e) {
    var self = this, items = [];
    e.def.acts.forEach(function (a, i) {
      items.push({ label: a.name, value: { kind: 'act', i: i },
                   desc: a.mercy > 0 ? '자비 +' + a.mercy : (a.mercy < 0 ? '자비 -' + (-a.mercy) : '') });
    });
    var G = this.G();
    items.push({
      label: '카오스 스피어  (TP 40)', color: '#7fdcff',
      enabled: G.tp >= 40, value: { kind: 'spear' },
      desc: '적 전체에게 카오스 에너지를 꽂는다.'
    });
    items.push({
      label: '카오스 컨트롤  (TP 100)', color: '#c0ff3c',
      enabled: G.tp >= 100, value: { kind: 'control' },
      desc: '다음 적 턴 동안 시간을 늦춘다.'
    });
    this.menu = new SH.Menu(items, { x: 76, y: 140, lh: 14, size: 10 });
    this.state = 'acts';
    this.actTarget = e;
  };

  Battle.prototype.openItems = function () {
    var G = this.G(), self = this;
    if (!G.items.length) {
      return this.say([{ text: '가진 아이템이 없다.' }], function () { self.state = 'menu'; });
    }
    var items = G.items.map(function (key, i) {
      var it = SH.Items[key];
      return { label: it.name, value: i, desc: it.heal ? ('HP +' + it.heal) : ('TP +' + it.tp) };
    });
    this.menu = new SH.Menu(items, { x: 76, y: 146, lh: 15, size: 11 });
    this.state = 'items';
  };

  Battle.prototype.openMercy = function () {
    var self = this;
    var anySpareable = this.living().some(function (e) { return self.isSpareable(e); });
    var items = [
      { label: 'SPARE', color: anySpareable ? '#7dff9b' : '#e2e2ec', value: 'spare',
        desc: anySpareable ? '지금이라면 놓아줄 수 있다.' : '아직 마음을 열지 않았다.' },
      { label: 'FLEE', value: 'flee',
        enabled: !this.isBoss && !this.enemies.some(function (e) { return e.def.noFlee; }),
        desc: '카오스 컨트롤로 이탈한다.' }
    ];
    this.menu = new SH.Menu(items, { x: 76, y: 150, lh: 16, size: 11 });
    this.state = 'mercy';
  };

  Battle.prototype.startAttackBar = function (e) {
    this.state = 'attackbar';
    this.bar = { x: 0, dir: 1, speed: 1.75, hit: null, t: 0, target: e };
  };

  Battle.prototype.resolveAttack = function () {
    var G = this.G(), bar = this.bar, e = bar.target;
    var acc = 1 - Math.abs(bar.x);                 // bar.x is -1..1, 0 is perfect
    var grade = acc > 0.92 ? 'PERFECT' : (acc > 0.7 ? 'GREAT' : (acc > 0.4 ? 'GOOD' : 'MISS'));
    var self = this;
    this.setPose('attack', 0.5);

    if (grade === 'MISS') {
      SH.Audio.sfx('cancel');
      this.say([{ text: 'MISS! 공격이 빗나갔다.' }], function () { self.startEnemyTurn(); });
      return;
    }
    var mult = { PERFECT: 2.2, GREAT: 1.6, GOOD: 1.15 }[grade];
    var dmg = Math.max(1, Math.round((G.atk + SH.rand(-2, 2)) * mult - e.def_));
    SH.Audio.sfx('slash');
    this.hitEnemy(e, dmg);
    G.tp = Math.min(G.maxtp, G.tp + 8);
    var lines = [{ text: grade + '!  ' + e.name + ' 에게 ' + dmg + ' 데미지.' }];
    if (!e.alive) lines.push({ text: e.def.onKill });
    this.say(lines, function () {
      if (!self.living().length) self.finish('win');
      else self.startEnemyTurn();
    });
  };

  Battle.prototype.doAct = function (e, idx) {
    var a = e.def.acts[idx], self = this;
    e.mercy = Math.max(0, e.mercy + (a.mercy || 0));
    if (a.atkUp) e.atk += a.atkUp;
    if (a.atkDown) e.atk = Math.max(1, e.atk - a.atkDown);
    if (a.defDown) e.def_ = Math.max(0, e.def_ - a.defDown);
    if (a.playerAtkUp) this.G().atk += a.playerAtkUp;
    if (a.chaosControl) this.chaosFrozen = 2.4;
    if (a.surrender) this.surrendered = true;
    e.usedActs[idx] = true;

    var lines = a.text.map(function (t) { return { text: t }; });
    if (this.isSpareable(e)) {
      lines.push({ text: '※ ' + e.name + ' 의 이름이 노랗게 빛난다. 이제 SPARE 할 수 있다.' });
    }
    this.say(lines, function () { self.startEnemyTurn(); });
  };

  Battle.prototype.doSpear = function () {
    var G = this.G(), self = this;
    G.tp -= 40;
    SH.Audio.sfx('chaos');
    SH.flash('#7fdcff', 0.2);
    this.setPose('attack', 0.6);
    var lines = [{ text: '카오스... 스피어!' }];
    this.living().forEach(function (e) {
      var dmg = Math.max(1, Math.round(G.atk * 1.5 - e.def_));
      self.hitEnemy(e, dmg);
      lines.push({ text: e.name + ' 에게 ' + dmg + ' 데미지.' });
      if (!e.alive) lines.push({ text: e.def.onKill });
    });
    this.say(lines, function () {
      if (!self.living().length) self.finish('win');
      else self.startEnemyTurn();
    });
  };

  Battle.prototype.doSpare = function () {
    var self = this;
    var sp = this.living().filter(function (e) { return self.isSpareable(e); });
    if (!sp.length) {
      return this.say([{ text: '아직 놓아줄 수 없다. ACT 로 마음을 돌려라.' }],
                      function () { self.startEnemyTurn(); });
    }
    var lines = [];
    sp.forEach(function (e) {
      e.spared = true; e.alive = false;
      self.spares.push(e.id);
      SH.Story.recordSpare(e.def.faction);
      lines.push({ text: e.def.onSpare });
    });
    SH.Audio.sfx('spare');
    this.say(lines, function () {
      if (!self.living().length) self.finish('spare');
      else self.startEnemyTurn();
    });
  };

  Battle.prototype.doFlee = function () {
    var self = this;
    SH.Story.recordFlee();
    SH.Audio.sfx('chaos');
    this.say([{ text: '카오스 컨트롤!' }], function () { self.finish('flee'); });
  };

  /* ---------- update ---------------------------------------------------- */
  Battle.prototype.update = function (dt) {
    var self = this, G = this.G();
    this.anim += dt;
    this.introT += dt;
    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) this.shadowPose = 'idle';
    }
    if (this.chaosFrozen > 0) this.chaosFrozen -= dt;
    if (this.soul.iframe > 0) this.soul.iframe -= dt;
    if (this.dmgPop) { this.dmgPop.t -= dt; if (this.dmgPop.t <= 0) this.dmgPop = null; }
    this.enemies.forEach(function (e) {
      if (e.flash > 0) e.flash -= dt;
      if (e.shakeT > 0) e.shakeT -= dt;
    });
    for (var i = this.fx.length - 1; i >= 0; i--) {
      this.fx[i].t += dt;
      if (this.fx[i].t >= this.fx[i].dur) this.fx.splice(i, 1);
    }

    switch (this.state) {

      case 'message':
        if (this.msg) this.msg.update(dt);
        break;

      case 'menu':
        if (SH.Input.pressed('right')) { this.btn = (this.btn + 1) % 4; SH.Audio.sfx('move'); }
        if (SH.Input.pressed('left')) { this.btn = (this.btn + 3) % 4; SH.Audio.sfx('move'); }
        if (SH.Input.pressed('confirm')) {
          SH.Audio.sfx('confirm');
          var k = BTN[this.btn].key;
          if (k === 'FIGHT') this.openTarget('fight');
          else if (k === 'ACT') this.openTarget('act');
          else if (k === 'ITEM') this.openItems();
          else this.openMercy();
        }
        break;

      case 'target': {
        var picked = this.menu.update();
        if (SH.Input.pressed('cancel')) { SH.Audio.sfx('cancel'); this.state = 'menu'; }
        if (picked) {
          var e = this.enemies[picked.value];
          if (this.afterTarget === 'fight') this.startAttackBar(e);
          else this.openActs(e);
        }
        break;
      }

      case 'acts': {
        var pick = this.menu.update();
        if (SH.Input.pressed('cancel')) { SH.Audio.sfx('cancel'); this.openTarget('act'); }
        if (pick) {
          var v = pick.value;
          if (v.kind === 'act') this.doAct(this.actTarget, v.i);
          else if (v.kind === 'spear') this.doSpear();
          else {
            G.tp -= 100;
            this.chaosFrozen = 3.2;
            SH.Audio.sfx('chaos');
            this.say([{ text: '카오스 컨트롤! 시간이 늦춰졌다.' }],
                     function () { self.startEnemyTurn(); });
          }
        }
        break;
      }

      case 'items': {
        var pi = this.menu.update();
        if (SH.Input.pressed('cancel')) { SH.Audio.sfx('cancel'); this.state = 'menu'; }
        if (pi) {
          var key = G.items[pi.value];
          var it = SH.Items[key];
          G.items.splice(pi.value, 1);
          if (it.heal) G.hp = Math.min(G.maxhp, G.hp + it.heal);
          if (it.tp) G.tp = Math.min(G.maxtp, G.tp + it.tp);
          SH.Audio.sfx('heal');
          this.say([{ text: it.text }], function () { self.startEnemyTurn(); });
        }
        break;
      }

      case 'mercy': {
        var pm = this.menu.update();
        if (SH.Input.pressed('cancel')) { SH.Audio.sfx('cancel'); this.state = 'menu'; }
        if (pm) {
          if (pm.value === 'spare') this.doSpare();
          else this.doFlee();
        }
        break;
      }

      case 'attackbar':
        this.bar.t += dt;
        this.bar.x += this.bar.dir * this.bar.speed * dt * 2;
        if (this.bar.x > 1) { this.bar.x = 1; this.bar.dir = -1; }
        if (this.bar.x < -1) { this.bar.x = -1; this.bar.dir = 1; }
        if (SH.Input.pressed('confirm')) this.resolveAttack();
        else if (SH.Input.pressed('cancel')) { SH.Audio.sfx('cancel'); this.state = 'menu'; }
        else if (this.bar.t > 4) { this.bar.x = 1; this.resolveAttack(); }
        break;

      case 'enemyturn': {
        var slow = this.chaosFrozen > 0 ? 0.35 : 1;
        this.pt += dt * slow;
        this.patternClock += dt * slow;
        if (this.pattern && this.patternClock >= (this.pattern.every || 0.5)) {
          this.patternClock = 0;
          this.pattern.step(this);
        }
        /* soul control */
        var ax = SH.Input.axis();
        var sp = SH.Input.down('cancel') ? 62 : 104;
        this.soul.x = SH.clamp(this.soul.x + ax.x * sp * dt, this.box.x + 5, this.box.x + this.box.w - 5);
        this.soul.y = SH.clamp(this.soul.y + ax.y * sp * dt, this.box.y + 5, this.box.y + this.box.h - 5);
        this.updateBullets(dt);
        if (this.pt > (this.pattern ? this.pattern.dur : 5) && !this.bullets.length) {
          this.endEnemyTurn(false);
        } else if (this.pt > (this.pattern ? this.pattern.dur : 5) + 2.5) {
          this.endEnemyTurn(false);
        }
        break;
      }
    }
  };

  /* ---------- draw ------------------------------------------------------- */
  Battle.prototype.drawBackdrop = function () {
    var t = this.anim;
    SH.rect(0, 0, SH.W, GROUND + 6, this.isBoss ? '#12060e' : '#0b0b14');
    /* parallax scan bands - cheap but sells the 16-bit stage backdrop */
    for (var i = 0; i < 9; i++) {
      var y = 18 + i * 11;
      SH.rect(0, y, SH.W, 1, i % 2 ? '#15152a' : '#101020');
    }
    for (var s = 0; s < 22; s++) {
      var sx = (s * 47 + Math.floor(t * 12)) % SH.W;
      var sy = 14 + (s * 13) % 92;
      SH.rect(sx, sy, 1, 1, s % 3 ? '#2a2a44' : '#3d3d63');
    }
    SH.rect(0, GROUND, SH.W, 3, '#2a2a3c');
    SH.rect(0, GROUND + 3, SH.W, 4, '#16161f');
  };

  Battle.prototype.drawActors = function () {
    var self = this;
    /* Shadow - left, facing right (DELTARUNE-style stand-off) */
    var sheet = this.superForm ? 'shadow_super' : 'shadow';
    var f;
    if (this.shadowPose === 'attack') f = SH.frameOf(sheet, 'attack', (this.anim * 10) | 0);
    else f = SH.frameOf(sheet, 'idle', (this.anim * 3) | 0);
    var bob = Math.sin(this.anim * 3) * 1;
    SH.drawFoot(sheet, f, 62, GROUND + bob);
    if (this.superForm) {
      for (var k = 0; k < 6; k++) {
        var a = this.anim * 3 + k;
        SH.rect(62 + Math.cos(a) * 16, GROUND - 22 + Math.sin(a) * 18, 2, 2, '#ffe066');
      }
    }

    /* enemies - right, mirrored to face Shadow */
    this.enemies.forEach(function (e) {
      if (!e.alive && !e.dead) return;
      if (e.dead || e.spared) return;
      var sx = e.shakeT > 0 ? SH.rand(-2, 2) : 0;
      var fr = e.anim === 2 ? SH.frameOf(e.sheet, 'attack', 0)
                            : SH.frameOf(e.sheet, 'idle', (self.anim * 2.5) | 0);
      var op = { flip: true };
      if (e.flash > 0 && Math.floor(e.flash * 20) % 2 === 0) op.alpha = 0.35;
      var float = e.hover ? Math.sin(self.anim * 2 + e.x) * 2 : 0;
      if (e.hover) {                       /* airborne units cast a ground shadow */
        SH.ctx.save();
        SH.ctx.globalAlpha = 0.3;
        SH.rect(e.x - 10, GROUND - 1, 20, 4, '#000');
        SH.ctx.restore();
      }
      SH.drawFoot(e.sheet, fr, e.x + sx, GROUND - e.hover + float, op);
    });

    this.fx.forEach(function (f2) {
      var i = Math.min(f2.n - 1, Math.floor(f2.t / f2.dur * f2.n));
      SH.drawC(f2.sheet, f2.sheet === 'hud' ? SH.frameOf('hud', 'graze0', 0) + i : i,
               f2.x, f2.y, {});
    });
  };

  Battle.prototype.drawStatus = function () {
    var G = this.G();
    if (!G) return;
    SH.rect(0, 0, SH.W, 16, '#05050a');
    SH.rect(0, 16, SH.W, 1, '#2a2a3c');
    SH.text('SHADOW', 6, 4, { color: '#f2f2f8', size: 10, bold: true });
    SH.text('LV ' + G.lv, 66, 4, { color: '#ffd23f', size: 10 });
    SH.text('HP', 96, 4, { color: '#f2f2f8', size: 10 });
    SH.bar(114, 5, 60, 8, G.hp / G.maxhp, '#d8232f', '#3a0d12');
    SH.text(Math.max(0, Math.ceil(G.hp)) + '/' + G.maxhp, 178, 4, { color: '#f2f2f8', size: 9 });
    SH.text('TP', 226, 4, { color: '#7fdcff', size: 10 });
    SH.bar(242, 5, 60, 8, G.tp / G.maxtp, '#7fdcff', '#0e2a38');
    if (this.dmgPop) {
      SH.text('-' + this.dmgPop.v, 62, GROUND - 56 - (0.8 - this.dmgPop.t) * 14,
              { color: '#ff5a5a', size: 12, bold: true, align: 'center' });
    }
  };

  Battle.prototype.drawButtons = function () {
    var self = this;
    BTN.forEach(function (b, i) {
      var x = 6 + i * 78, y = 216, w = 72, h = 22;
      var on = (self.state === 'menu' && self.btn === i);
      SH.rect(x, y, w, h, '#05050a');
      SH.frameRect(x, y, w, h, on ? '#ffd23f' : b.color, 2);
      SH.draw('hud', SH.frameOf('hud', b.icon, 0), x + 5, y + 3, { alpha: on ? 1 : 0.85 });
      SH.text(b.label, x + 24, y + 6, { color: on ? '#ffd23f' : b.color, size: 10, bold: true });
    });
  };

  Battle.prototype.drawBox = function () {
    var b = this.box;
    SH.rect(b.x, b.y, b.w, b.h, '#000');
    SH.frameRect(b.x, b.y, b.w, b.h, '#f2f2f8', 2);
    var self = this;
    /* clip so nothing that has left the arena paints over the UI */
    SH.ctx.save();
    SH.ctx.beginPath();
    SH.ctx.rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    SH.ctx.clip();
    this.bullets.forEach(function (bl) {
      if (bl.warn > 0 && bl.tick < bl.warn) {
        if (Math.floor(bl.tick * 16) % 2 === 0) {
          SH.rect(bl.x - bl.w / 2, bl.y - bl.h / 2, bl.w, bl.h, '#ff5a5a');
        }
        return;
      }
      var o = {};
      if (self.chaosFrozen > 0) o.alpha = 0.6;
      SH.drawC(bl.spr, 0, bl.x, bl.y, o);
    });
    /* the soul */
    if (!(this.soul.iframe > 0 && Math.floor(this.soul.iframe * 16) % 2 === 0)) {
      SH.drawC('hud', SH.frameOf('hud', 'soul', 0), this.soul.x, this.soul.y, {});
    }
    SH.ctx.restore();
    if (this.chaosFrozen > 0) {
      SH.text('CHAOS CONTROL', b.x + b.w / 2, b.y + 4,
              { color: '#c0ff3c', size: 9, align: 'center' });
    }
  };

  /* The attacker's line sits above the bullet box so it never fights
     the soul or the bullets for space. */
  Battle.prototype.drawEnemyLine = function () {
    if (!this.enemyLine) return;
    var w = SH.textWidth(this.enemyLine, 9) + 12;
    SH.ctx.save();
    SH.ctx.globalAlpha = 0.9;
    SH.rect(SH.W / 2 - w / 2, 111, w, 13, '#05050a');
    SH.ctx.restore();
    SH.text(this.enemyLine, SH.W / 2, 113, { color: '#c9c9dd', size: 9, align: 'center' });
  };

  Battle.prototype.drawAttackBar = function () {
    var b = this.box;
    SH.rect(b.x, b.y, b.w, b.h, '#000');
    SH.frameRect(b.x, b.y, b.w, b.h, '#f2f2f8', 2);
    var cx = b.x + b.w / 2, y = b.y + b.h / 2;
    SH.rect(b.x + 12, y - 12, b.w - 24, 24, '#141420');
    /* graded zones */
    SH.rect(cx - 44, y - 12, 88, 24, '#3a1d0e');
    SH.rect(cx - 22, y - 12, 44, 24, '#5a3a10');
    SH.rect(cx - 6, y - 12, 12, 24, '#7a5a12');
    SH.rect(cx - 1, y - 14, 2, 28, '#ffd23f');
    var px = cx + this.bar.x * (b.w / 2 - 16);
    SH.rect(px - 2, y - 16, 4, 32, '#f2f2f8');
    SH.text('Z 키로 타이밍을 맞춰라', cx, b.y + 8, { color: '#9b9bb4', size: 9, align: 'center' });
    SH.text(this.bar.target.name, cx, b.y + b.h - 16, { color: '#ffd23f', size: 10, align: 'center' });
  };

  Battle.prototype.draw = function () {
    this.drawBackdrop();
    this.drawActors();
    this.drawStatus();

    /* enemy name plates */
    var self = this;
    this.enemies.forEach(function (e, i) {
      if (!e.alive) return;
      var sh = SH.Assets.sheet(e.sheet);
      var top = GROUND - e.hover - (sh ? sh.fh : 44);
      var ny = SH.clamp(top - 14 - (i % 2) * 11, 20, GROUND - 20);
      var col = self.isSpareable(e) ? '#ffd23f' : '#c9c9dd';
      SH.text(e.name, e.x, ny, { color: col, size: 9, align: 'center' });
      SH.bar(e.x - 22, ny + 10, 44, 4, e.hp / e.maxhp, '#7dff9b', '#123a1c');
    });

    if (this.state === 'message' && this.msg) {
      this.msg.draw();
    } else if (this.state === 'enemyturn') {
      this.drawEnemyLine();
      this.drawBox();
    } else if (this.state === 'attackbar') {
      this.drawAttackBar();
    } else {
      /* menu / list region */
      SH.panel(8, 130, 304, 82, { fill: '#000', border: '#f2f2f8', lw: 2 });
      if (this.state === 'menu') {
        SH.text('* ' + (this.flavor || ''), 22, 146, { color: '#f2f2f8', size: 10 });
        SH.text('← → 로 행동 선택 · Z 결정', 22, 190, { color: '#6e6e88', size: 9 });
      } else if (this.menu) {
        var head = { target: '대상 선택', acts: 'ACT', items: 'ITEM', mercy: 'MERCY' }[this.state];
        SH.text(head, 22, 136, { color: '#ffd23f', size: 9 });
        this.menu.draw();
      }
    }
    this.drawButtons();
  };

  /* ==================================================================== */
  SH.startBattle = function (ids, opt) {
    SH.push(new Battle(ids, opt));
  };
  SH.Battle = Battle;
})(window.SH = window.SH || {});
