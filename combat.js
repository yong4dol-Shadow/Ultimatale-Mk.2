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
  /* UNDERTALE's command buttons are all one colour and the cursor is the
     only thing that changes: orange at rest, yellow on the selected one.
     Four different colours made the row read as four unrelated widgets. */
  var BTN_OFF = '#ff8a1f', BTN_ON = '#ffef5a';
  var BTN = [
    { key: 'FIGHT', label: 'FIGHT', icon: 'icon_fight' },
    { key: 'ACT',   label: 'ACT',   icon: 'icon_act' },
    { key: 'ITEM',  label: 'ITEM',  icon: 'icon_item' },
    { key: 'MERCY', label: 'MERCY', icon: 'icon_mercy' }
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
    this.chaosPending = 0;
    this.tpFlash = 0;
    this.grazeGlow = 0;
    this.grazeHold = 0;
    this.tracer = null;
    this.pendingShot = null;
    this.pops = [];
    this.bursts = [];
    this.spears = [];
    this.afterImages = [];
    this.ctrlT = undefined;
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

  /* Small text that drifts up and fades - what DELTARUNE puts next to the
     soul every time a graze tops up TP. */
  Battle.prototype.pop = function (text, x, y, col, size) {
    this.pops.push({ text: text, x: x, y: y, col: col || '#7fdcff',
                     size: size || 8, t: 0, dur: 0.7 });
  };

  /* Ring / shockwave / spark primitives the Chaos moves are built from. */
  Battle.prototype.addBurst = function (o) {
    this.bursts.push({
      x: o.x, y: o.y, t: 0, dur: o.dur || 0.5, kind: o.kind || 'ring',
      r0: o.r0 || 2, r1: o.r1 || 40, col: o.col || '#ffd23f',
      col2: o.col2 || '#ffffff', n: o.n || 10
    });
  };

  /* ---------- scene lifecycle ------------------------------------------ */
  Battle.prototype.enter = function () {
    SH.Audio.play(this.bgm);
    SH.Story.recordBattle();
    var names = this.enemies.map(function (e) { return e.name; }).join(', ');
    var self = this;
    SH.Tips.show('bt_intro', '← → 로 행동을 고르고 Z 로 결정.  FIGHT 는 처치, ACT·MERCY 는 살려보내기.');
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
  /* Roughly the middle of an enemy's sprite - flyers sit `hover` pixels off
     the floor, so hits used to land under the beetles instead of on them. */
  Battle.prototype.bodyY = function (e) {
    var sh = SH.Assets.sheet(e.sheet);
    return GROUND - e.hover - (sh ? sh.fh : 44) * 0.5;
  };

  /* `kind` picks the impact art: 'shot' is a pistol round landing, anything
     else is the energy hit the Chaos moves deal. */
  Battle.prototype.hitEnemy = function (e, dmg, kind) {
    e.hp -= dmg;
    e.flash = 0.35;
    e.shakeT = 0.3;
    var by = this.bodyY(e);
    if (kind === 'shot') {
      this.addFx('fx_hit', e.x + SH.rand(-4, 4), by + SH.rand(-5, 5), 3, 0.18);
      SH.shake(3, 0.12);
    } else if (kind === 'spear') {
      /* the lance set them alight as it punched through, back during the
         flight; a second effect here would just double up */
      SH.shake(3, 0.1);
    } else {
      this.addFx('fx_slash', e.x, by, 3, 0.24);
      SH.shake(4, 0.18);
    }
    if (e.hp <= 0) {
      e.hp = 0;
      e.alive = false;
      e.dead = true;
      this.kills.push(e.id);
      SH.Story.recordKill(e.def.faction);
      SH.Audio.sfx('kill');
      this.addFx('fx_boom', e.x, by, 4, 0.4);
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
    this.chaosFrozen = this.chaosPending;
    this.chaosPending = 0;
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
    SH.Tips.show('bt_dodge', '적 턴이다.  방향키로 하트를 움직여 탄막을 피해라.  X 를 누르면 천천히 움직인다.');
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
        this.gainTp(22 * dt, this.soul);
        /* DELTARUNE marks a graze by lighting the soul's own outline, so the
           reading happens where the player's eyes already are. */
        this.grazeGlow = Math.min(1, this.grazeGlow + dt * 9);
        this.grazeHold = 0.16;
        if (!b.grazed) {
          b.grazed = true;
          SH.Audio.sfx('graze');
          SH.Tips.show('bt_graze', 'TP 는 0에서 시작한다.  탄에 스치거나 명중시키면 차오른다.');
        }
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
    this.menu = new SH.Menu(items, { x: 60, y: 152, lh: 16, size: 11, descY: 200 });
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
      label: '카오스 스피어 (TP40)', color: '#7fdcff',
      enabled: G.tp >= 40, value: { kind: 'spear' },
      desc: '적 전체를 관통한다.  방어를 절반만 계산한다.'
    });
    items.push({
      label: '카오스 블래스트 (TP100)', color: '#ff8a1f',
      enabled: G.tp >= 100, value: { kind: 'blast' },
      desc: '주변을 통째로 터뜨린다. 방어를 무시하는 최대 화력.'
    });
    this.menu = new SH.Menu(items, { x: 20, y: 150, lh: 16, size: 10,
                                     columns: 2, width: 134, descY: 200 });
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
    this.menu = new SH.Menu(items, { x: 60, y: 152, lh: 15, size: 11, descY: 200 });
    this.state = 'items';
  };

  Battle.prototype.openMercy = function () {
    var self = this;
    var anySpareable = this.living().some(function (e) { return self.isSpareable(e); });
    var items = [
      { label: 'SPARE', color: anySpareable ? '#7dff9b' : '#e2e2ec', value: 'spare',
        desc: anySpareable ? '지금이라면 놓아줄 수 있다.' : '아직 마음을 열지 않았다.' },
      { label: '카오스 컨트롤', color: '#c0ff3c', value: 'flee',
        enabled: !this.isBoss && !this.enemies.some(function (e) { return e.def.noFlee; }),
        desc: '시공을 뛰어넘어 전장에서 이탈한다.' }
    ];
    this.menu = new SH.Menu(items, { x: 60, y: 154, lh: 16, size: 11, descY: 200 });
    this.state = 'mercy';
  };

  Battle.prototype.startAttackBar = function (e) {
    this.state = 'attackbar';
    /* UNDERTALE's bar: the cursor makes one pass across the meter and you
       press once. Let it run off the end and the swing misses. */
    this.bar = { x: -1, dir: 1, speed: 1.15, t: 0, target: e };
    SH.Tips.show('bt_fight', '바가 한가운데를 지날 때 Z!  정확할수록 세게 들어간다.');
  };

  Battle.prototype.resolveAttack = function () {
    var G = this.G(), bar = this.bar, e = bar.target;
    var acc = 1 - Math.abs(bar.x);                 // bar.x is -1..1, 0 is perfect
    var grade = acc > 0.92 ? 'PERFECT' : (acc > 0.7 ? 'GREAT' : (acc > 0.4 ? 'GOOD' : 'MISS'));
    var self = this;

    /* Shadow's sidearm: fire the shot, fly a tracer over, then land it */
    this.setPose('shoot', grade === 'MISS' ? 0.5 : 0.75);
    SH.Audio.sfx('gunshot');
    this.state = 'shooting';
    /* the barrel sits about here once the shoot frame is drawn at x=62 */
    this.tracer = { x: 84, y: GROUND - 40, tx: e.x, ty: GROUND - 26, t: 0,
                    dur: 0.22, miss: grade === 'MISS' };
    this.pendingShot = function () {
      if (grade === 'MISS') {
        SH.Audio.sfx('cancel');
        self.say([{ text: 'MISS! 총알이 빗나갔다.' }], function () { self.startEnemyTurn(); });
        return;
      }
      var mult = { PERFECT: 2.2, GREAT: 1.6, GOOD: 1.15 }[grade];
      var dmg = Math.max(1, Math.round((G.atk + SH.rand(-2, 2)) * mult - e.def_));
      self.hitEnemy(e, dmg, 'shot');
      self.gainTp(8, { x: e.x, y: GROUND - 40 });
      var lines = [{ text: grade + '!  ' + e.name + ' 에게 ' + dmg + ' 데미지.' }];
      if (!e.alive) lines.push({ text: e.def.onKill });
      self.say(lines, function () {
        if (!self.living().length) self.finish('win');
        else self.startEnemyTurn();
      });
    };
  };

  /* TP is the whole point of the two Chaos moves, so call it out the first
     time each threshold is crossed. */
  Battle.prototype.gainTp = function (n, showAt) {
    var G = this.G();
    if (!G) return;
    var before = G.tp;
    G.tp = Math.min(G.maxtp, G.tp + n);
    if (showAt && showAt !== this.soul) {
      /* off-soul gains (a landed shot, a spared enemy) still pop a number */
      this.tpDrip = (this.tpDrip || 0) + (G.tp - before);
      if (this.tpDrip >= 1) {
        var whole = Math.floor(this.tpDrip);
        this.tpDrip -= whole;
        this.pop('+' + whole + ' TP', showAt.x + SH.rand(-6, 6),
                 showAt.y - 12 + SH.rand(-4, 4), '#7fdcff', 8);
      }
    }
    if (before < 40 && G.tp >= 40) {
      this.tpFlash = 1.0;
      SH.Tips.show('bt_tp40', 'TP 40!  ACT 의 카오스 스피어는 적 전체를 관통하고 방어를 절반만 계산한다.');
    }
    if (before < 100 && G.tp >= 100) {
      this.tpFlash = 1.2;
      SH.Tips.show('bt_tp100', 'TP 최대!  ACT 의 카오스 블래스트는 방어를 무시하고 전체를 태운다.');
    }
  };

  Battle.prototype.doAct = function (e, idx) {
    var a = e.def.acts[idx], self = this;
    e.mercy = Math.max(0, e.mercy + (a.mercy || 0));
    if (a.atkUp) e.atk += a.atkUp;
    if (a.atkDown) e.atk = Math.max(1, e.atk - a.atkDown);
    if (a.defDown) e.def_ = Math.max(0, e.def_ - a.defDown);
    if (a.playerAtkUp) this.G().atk += a.playerAtkUp;

    if (a.surrender) this.surrendered = true;
    e.usedActs[idx] = true;

    var lines = a.text.map(function (t) { return { text: t }; });
    if (a.chaosControl) {
      /* Devil Doom's own Chaos Control ACT plays the same fold */
      this.chaosPending = 2.4;
      this.startChaosControl(function () {
        self.say(lines, function () { self.startEnemyTurn(); });
      });
      return;
    }
    if (this.isSpareable(e)) {
      lines.push({ text: '※ ' + e.name + ' 의 이름이 노랗게 빛난다. 이제 SPARE 할 수 있다.' });
      SH.Tips.show('bt_spare', '이름이 노랗게 빛나면 MERCY → SPARE 로 살려보낼 수 있다.');
    }
    this.say(lines, function () { self.startEnemyTurn(); });
  };

  /* Chaos Spear - golden energy lances thrown one after another. The
     damage waits until each lance actually lands. */
  Battle.prototype.doSpear = function () {
    var G = this.G(), self = this;
    G.tp -= 40;
    SH.Audio.sfx('chaos');
    SH.flash('#ffe066', 0.3);
    SH.shake(5, 0.35);
    this.setPose('attack', 1.6);
    this.state = 'chaosfx';
    /* long enough for the last staggered lance to land and burn */
    this.fxTimer = 0.95 + this.living().length * 0.16;
    /* charge: two counter-rotating rings collapsing into the hand, then a
       gold flash - the single small ring read as a loading spinner */
    this.addBurst({ x: 84, y: GROUND - 40, kind: 'charge', r0: 26, r1: 2,
                    dur: 0.34, col: '#ffd23f', col2: '#ffffff' });
    this.addBurst({ x: 84, y: GROUND - 40, kind: 'charge', r0: 17, r1: 3,
                    dur: 0.28, col: '#ffffff', col2: '#ff8a1f' });
    this.addBurst({ x: 84, y: GROUND - 40, kind: 'ring', r0: 22, r1: 3,
                    dur: 0.3, col: '#ffd23f', col2: '#ffffff' });

    var targets = this.living();
    this.spears = targets.map(function (e, i) {
      var ty = self.bodyY(e);
      /* the lance does not stop at the target - it runs it through and
         carries on off-screen, which is what makes it read as a spear
         rather than a bullet */
      return { x: 84, y: GROUND - 40, tx: e.x, ty: ty,
               ex: e.x + (e.x - 84) * 0.55, ey: ty + (ty - (GROUND - 40)) * 0.55,
               t: -0.34 - i * 0.16, dur: 0.24, hitAt: 0.24, over: 0.2,
               e: e, done: false };
    });
    this.pendingChaos = function () {
      var lines = [{ text: '카오스... 스피어!' }];
      targets.forEach(function (e) {
        if (!e.alive) return;
        /* A lance is worth its 40 TP only if it beats a well-timed normal
           shot: 2.2x attack, and being an energy lance it runs through
           half the target's DEF.  At 1.5x with full DEF applied it landed
           under a GREAT-timed sidearm hit and there was no reason to spend
           the bar on it. */
        var dmg = Math.max(1, Math.round(G.atk * 2.2 + SH.rand(-2, 2)
                                         - e.def_ * 0.5));
        self.hitEnemy(e, dmg, 'spear');
        lines.push({ text: e.name + ' 에게 ' + dmg + ' 데미지.' });
        if (!e.alive) lines.push({ text: e.def.onKill });
      });
      self.say(lines, function () {
        if (!self.living().length) self.finish('win');
        else self.startEnemyTurn();
      });
    };
  };

  /* Chaos Blast - the big TP spend: hits everything and ignores DEF. */
  /* Chaos Blast - a red detonation centred on Shadow that swallows the
     whole field: implosion, shockwave rings, then the damage. */
  Battle.prototype.doBlast = function () {
    var G = this.G(), self = this;
    G.tp -= 100;
    SH.Audio.sfx('blast');
    this.setPose('attack', 1.6);
    this.state = 'chaosfx';
    this.fxTimer = 1.15;
    this.blastAt = 0.42;                       // when the wave reaches them

    /* pull in, then blow out */
    this.addBurst({ x: 62, y: GROUND - 30, kind: 'charge', r0: 46, r1: 3,
                    dur: 0.4, col: '#ff2d2d', col2: '#ffd23f' });
    var targets = this.living();
    this.pendingChaos = function () {
      var lines = [{ text: '카오스... 블래스트!!' }];
      targets.forEach(function (e) {
        if (!e.alive) return;
        var dmg = Math.max(1, Math.round(G.atk * 3.5 + SH.rand(-3, 3)));
        self.hitEnemy(e, dmg);
        lines.push({ text: e.name + ' 에게 ' + dmg + ' 데미지!' });
        if (!e.alive) lines.push({ text: e.def.onKill });
      });
      self.say(lines, function () {
        if (!self.living().length) self.finish('win');
        else self.startEnemyTurn();
      });
    };
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

  /* Chaos Control - time folds: the field stalls, ripples out from Shadow,
     drops a trail of after-images, then snaps shut. */
  Battle.prototype.startChaosControl = function (after) {
    var self = this;
    SH.Audio.sfx('control');
    this.state = 'chaosfx';
    this.fxTimer = 1.05;
    this.ctrlT = 0;
    this.ctrlRipples = 0;
    this.afterImages = [];
    this.pendingChaos = after;
    this.addBurst({ x: 62, y: GROUND - 30, kind: 'charge', r0: 40, r1: 6,
                    dur: 0.55, col: '#c0ff3c', col2: '#ffffff' });
    SH.flash('#c0ff3c', 0.35);
  };

  Battle.prototype.doFlee = function () {
    var self = this;
    SH.Story.recordFlee();
    this.startChaosControl(function () {
      self.say([{ text: '카오스 컨트롤!  시공을 접고 전장을 빠져나왔다.' }],
               function () { self.finish('flee'); });
    });
  };

  /* ---------- update ---------------------------------------------------- */
  Battle.prototype.update = function (dt) {
    var self = this, G = this.G();
    if (this.spears === undefined) this.spears = [];
    this.anim += dt;
    this.introT += dt;
    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) this.shadowPose = 'idle';
    }
    /* only counts down during the enemy turn - it used to tick while the
       player read the message that announced it, so it expired unused */
    if (this.state === 'enemyturn' && this.chaosFrozen > 0) this.chaosFrozen -= dt;
    if (this.soul.iframe > 0) this.soul.iframe -= dt;
    if (this.tpFlash > 0) this.tpFlash -= dt;
    /* the graze outline fades out over a few frames so a stream of near
       misses reads as one steady glow instead of a strobe */
    if (this.grazeHold > 0) this.grazeHold -= dt;
    else if (this.grazeGlow > 0) this.grazeGlow = Math.max(0, this.grazeGlow - dt * 4);
    if (this.dmgPop) { this.dmgPop.t -= dt; if (this.dmgPop.t <= 0) this.dmgPop = null; }
    this.enemies.forEach(function (e) {
      if (e.flash > 0) e.flash -= dt;
      if (e.shakeT > 0) e.shakeT -= dt;
    });
    for (var i = this.fx.length - 1; i >= 0; i--) {
      this.fx[i].t += dt;
      if (this.fx[i].t >= this.fx[i].dur) this.fx.splice(i, 1);
    }
    for (var pi = this.pops.length - 1; pi >= 0; pi--) {
      this.pops[pi].t += dt;
      if (this.pops[pi].t >= this.pops[pi].dur) this.pops.splice(pi, 1);
    }
    for (var bi = this.bursts.length - 1; bi >= 0; bi--) {
      this.bursts[bi].t += dt;
      if (this.bursts[bi].t >= this.bursts[bi].dur) this.bursts.splice(bi, 1);
    }

    switch (this.state) {

      case 'message':
        if (this.msg) this.msg.update(dt);
        break;

      case 'chaosfx': {
        this.fxTimer -= dt;
        if (this.ctrlT !== undefined) {
          this.ctrlT += dt;
          /* three ripples leave the caster, one per beat. Driven from the
             game clock, not setTimeout: a wall-clock timer keeps firing
             after the battle has moved on. */
          while (this.ctrlRipples < 3 && this.ctrlT >= this.ctrlRipples * 0.18) {
            this.ctrlRipples++;
            this.addBurst({ x: 62, y: GROUND - 30, kind: 'ring', r0: 3, r1: 200,
                            dur: 0.7, col: '#c0ff3c', col2: '#ffffff' });
          }
          /* Shadow smears sideways as the fold takes hold */
          if (this.afterImages.length < 7 && this.ctrlT > this.afterImages.length * 0.09) {
            this.afterImages.push({ x: 62 + this.afterImages.length * 13, t: 0 });
          }
          this.afterImages.forEach(function (ai) { ai.t += dt; });
        }
        var anyLanded = false;
        this.spears.forEach(function (sp) {
          sp.t += dt;
          /* `done` retires the lance once it has flown clear of the target;
             the strike itself fires the moment it reaches them */
          if (!sp.struck && sp.t >= sp.hitAt) {
            sp.struck = true;
            anyLanded = true;
            /* a quick thin ring - a slow fat one leaves a dark disc sitting
               on top of the enemy, because the ring is drawn as alternating
               filled ellipses */
            self.addBurst({ x: sp.tx, y: sp.ty, kind: 'ring', r0: 3, r1: 30,
                            dur: 0.24, col: '#ffd23f', col2: '#ffffff' });
            self.addBurst({ x: sp.tx, y: sp.ty, kind: 'spark', n: 14, r1: 46,
                            dur: 0.42, col: '#ffe066' });
            /* the wound catches fire: one flame on the body and two smaller
               ones offset, staggered so it flickers */
            self.addFx('fx_flare', sp.tx, sp.ty, 4, 0.42);
            self.fx.push({ sheet: 'fx_flare', x: sp.tx - 6, y: sp.ty + 4,
                           n: 4, t: -0.09, dur: 0.36 });
            self.fx.push({ sheet: 'fx_flare', x: sp.tx + 5, y: sp.ty - 3,
                           n: 4, t: -0.16, dur: 0.34 });
            sp.e.flash = 0.4;
            sp.e.shakeT = 0.35;
            SH.shake(6, 0.2);
          }
          if (!sp.done && sp.t >= sp.hitAt + sp.over) sp.done = true;
        });
        if (anyLanded) SH.Audio.sfx('slash');
        /* the blast's shockwave, fired once when the ring reaches the line */
        if (this.blastAt !== undefined && this.fxTimer <= 1.15 - this.blastAt) {
          this.blastAt = undefined;
          SH.flash('#ff2d2d', 0.55);
          SH.shake(14, 0.9);
          this.addBurst({ x: 62, y: GROUND - 30, kind: 'ring', r0: 4, r1: 230,
                          dur: 0.55, col: '#ff2d2d', col2: '#ffd23f' });
          this.addBurst({ x: 62, y: GROUND - 30, kind: 'ring', r0: 2, r1: 170,
                          dur: 0.42, col: '#ffffff', col2: '#ff8a1f' });
          this.addBurst({ x: 62, y: GROUND - 30, kind: 'spark', n: 22, r1: 150,
                          dur: 0.6, col: '#ff8a1f' });
          this.living().forEach(function (e) {
            self.addFx('fx_boom', e.x, self.bodyY(e), 4, 0.5);
          });
        }
        if (this.fxTimer <= 0) {
          this.ctrlT = undefined;
          this.ctrlRipples = 0;
          this.afterImages = [];
          this.spears.length = 0;
          var go2 = this.pendingChaos;
          this.pendingChaos = null;
          if (go2) go2();
        }
        break;
      }

      case 'shooting': {
        var tr = this.tracer;
        tr.t += dt;
        if (tr.t >= tr.dur) {
          this.tracer = null;
          var go = this.pendingShot;
          this.pendingShot = null;
          if (go) go();
        }
        break;
      }

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
          else this.doBlast();
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
        this.bar.x += this.bar.speed * dt * 2;
        if (SH.Input.pressed('confirm')) this.resolveAttack();
        else if (SH.Input.pressed('cancel')) { SH.Audio.sfx('cancel'); this.state = 'menu'; }
        else if (this.bar.x > 1.15) { this.bar.x = 1.2; this.resolveAttack(); }
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
    if (this.shadowPose === 'shoot') {
      /* the recoil frame carries the muzzle flash, so hold it briefly */
      f = SH.frameOf(sheet, this.poseTimer > 0.45 ? 'shoot' : 'aim', 0);
    } else if (this.shadowPose === 'attack') {
      f = SH.frameOf(sheet, 'attack', (this.anim * 10) | 0);
    } else {
      f = SH.frameOf(sheet, 'idle', (this.anim * 3) | 0);
    }
    var bob = Math.sin(this.anim * 3) * 1;
    SH.groundShadow(62, GROUND + 1, 11, 3.4, 0.42);
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
      var sh0 = SH.Assets.sheet(e.sheet);
      var srx = (sh0 ? sh0.fw : 40) * 0.3;
      /* airborne units cast a smaller, fainter shadow the higher they float */
      SH.groundShadow(e.x + sx, GROUND + 1, e.hover ? srx * 0.8 : srx,
                      3.4, e.hover ? 0.26 : 0.42);
      SH.drawFoot(e.sheet, fr, e.x + sx, GROUND - e.hover + float, op);
    });

    /* Chaos Control: after-images of the caster streaking away */
    if (this.ctrlT !== undefined) {
      var sheetC = this.superForm ? 'shadow_super' : 'shadow';
      var self2 = this;
      this.afterImages.forEach(function (ai, i) {
        var fade = SH.clamp(1 - ai.t * 1.1, 0, 1) * 0.5;
        if (fade <= 0) return;
        SH.drawFoot(sheetC, SH.frameOf(sheetC, 'attack', 0), ai.x, GROUND,
                    { alpha: fade });
      });
      /* horizontal tear-lines across the field while time is folded */
      SH.ctx.save();
      for (var ln = 0; ln < 7; ln++) {
        var ly = 22 + ((ln * 17 + this.ctrlT * 90) % 100);
        SH.ctx.globalAlpha = 0.25 * SH.clamp(1.6 - this.ctrlT, 0, 1);
        SH.rect(0, ly, SH.W, 1, '#c0ff3c');
      }
      SH.ctx.restore();
    }

    /* rings, shockwaves and sparks */
    this.bursts.forEach(function (b2) {
      var k = b2.t / b2.dur;
      SH.ctx.save();
      SH.ctx.globalAlpha = 1 - k;
      if (b2.kind === 'ring') {
        var r = SH.lerp(b2.r0, b2.r1, k);
        SH.ellipseFill(b2.x, b2.y, r, r * 0.66, b2.col);
        SH.ctx.globalAlpha = (1 - k) * 0.9;
        SH.ellipseFill(b2.x, b2.y, Math.max(0, r - 5), Math.max(0, r - 5) * 0.66, '#000');
        SH.ctx.globalAlpha = (1 - k) * 0.8;
        SH.ellipseFill(b2.x, b2.y, Math.max(0, r - 8), Math.max(0, r - 8) * 0.66, b2.col2);
        SH.ctx.globalAlpha = (1 - k) * 0.75;
        SH.ellipseFill(b2.x, b2.y, Math.max(0, r - 11), Math.max(0, r - 11) * 0.66, '#000');
      } else if (b2.kind === 'charge') {
        var cr = SH.lerp(b2.r0, b2.r1, k);
        for (var q = 0; q < 8; q++) {
          var a2 = q * 0.785 + k * 5;
          SH.rect(b2.x + Math.cos(a2) * cr, b2.y + Math.sin(a2) * cr * 0.7, 3, 3,
                  q % 2 ? b2.col : b2.col2);
        }
      } else {                                   /* spark */
        for (var q2 = 0; q2 < b2.n; q2++) {
          var a3 = q2 * (6.283 / b2.n) + b2.x;
          var d2 = k * b2.r1;
          SH.rect(b2.x + Math.cos(a3) * d2, b2.y + Math.sin(a3) * d2 * 0.7,
                  2, 2, b2.col);
        }
      }
      SH.ctx.restore();
    });

    /* Chaos Spear lances in flight.  This used to be a 6x3 dash with a
       dotted tail, which at 320x240 read as a thrown pencil.  It is drawn
       as an actual lance now: a long tapered shaft with a white-hot core,
       a gold aura, a barbed head and a wake of sparks. */
    var anim = this.anim;
    this.spears.forEach(function (sp) {
      if (sp.t < 0 || sp.done) return;
      /* flight runs past the target, so k goes over 1 on the follow-through */
      var k2 = Math.max(0, sp.t / sp.hitAt);
      var ax = SH.lerp(sp.x, sp.ex, k2 * (sp.hitAt / (sp.hitAt + sp.over)));
      var ay = SH.lerp(sp.y, sp.ey, k2 * (sp.hitAt / (sp.hitAt + sp.over)));
      var ang2 = Math.atan2(sp.ey - sp.y, sp.ex - sp.x);
      var cs = Math.cos(ang2), sn = Math.sin(ang2);
      var px2 = -sn, py2 = cs;                    /* perpendicular */
      var fade = sp.struck ? SH.clamp(1 - (sp.t - sp.hitAt) / sp.over, 0, 1) : 1;

      function lance(len, half, col, alpha) {
        SH.ctx.save();
        SH.ctx.globalAlpha = alpha * fade;
        SH.ctx.beginPath();
        SH.ctx.moveTo(ax + cs * 9, ay + sn * 9);                  /* tip */
        SH.ctx.lineTo(ax + px2 * half, ay + py2 * half);
        SH.ctx.lineTo(ax - cs * len + px2 * half * 0.25,
                      ay - sn * len + py2 * half * 0.25);
        SH.ctx.lineTo(ax - cs * len - px2 * half * 0.25,
                      ay - sn * len - py2 * half * 0.25);
        SH.ctx.lineTo(ax - px2 * half, ay - py2 * half);
        SH.ctx.closePath();
        SH.ctx.fillStyle = col;
        SH.ctx.fill();
        SH.ctx.restore();
      }

      lance(30, 6.0, '#ff8a1f', 0.55);            /* orange aura */
      lance(26, 4.2, '#ffd23f', 0.95);            /* gold shaft */
      lance(17, 2.0, '#ffffff', 1);               /* white-hot core */

      /* barbs, the pair of fins that make it a Chaos Spear and not a bolt */
      SH.ctx.save();
      SH.ctx.globalAlpha = 0.9 * fade;
      for (var bd = -1; bd <= 1; bd += 2) {
        SH.ctx.beginPath();
        SH.ctx.moveTo(ax - cs * 3, ay - sn * 3);
        SH.ctx.lineTo(ax - cs * 11 + px2 * bd * 8, ay - sn * 11 + py2 * bd * 8);
        SH.ctx.lineTo(ax - cs * 13, ay - sn * 13);
        SH.ctx.closePath();
        SH.ctx.fillStyle = '#ffd23f';
        SH.ctx.fill();
      }
      SH.ctx.restore();

      /* wake: sparks shed along the path behind the shaft */
      SH.ctx.save();
      for (var w3 = 0; w3 < 9; w3++) {
        var d3 = 14 + w3 * 6;
        var off = Math.sin(anim * 30 + w3 * 1.7) * (2 + w3 * 0.7);
        SH.ctx.globalAlpha = (1 - w3 / 9) * 0.7 * fade;
        SH.rect(ax - cs * d3 + px2 * off, ay - sn * d3 + py2 * off,
                3 - (w3 > 4 ? 1 : 0), 3 - (w3 > 4 ? 1 : 0),
                w3 % 3 ? '#ffd23f' : '#ffffff');
      }
      SH.ctx.restore();
    });

    /* the tracer from Shadow's sidearm */
    if (this.tracer) {
      var tr = this.tracer, k = tr.t / tr.dur;
      var bx = SH.lerp(tr.x, tr.tx, k);
      var by = SH.lerp(tr.y, tr.ty, k) + (tr.miss ? -k * k * 26 : 0);
      /* a pistol round, not a cannon shell */
      SH.rect(bx, by, 2, 2, '#ffffff');
      SH.ctx.save();
      SH.ctx.globalAlpha = 0.4;
      SH.rect(bx - 4, by + 0.5, 3, 1, '#ffd23f');
      SH.ctx.restore();
      if (k < 0.45) {                       /* muzzle flash at the barrel */
        var fa = 1 - k / 0.45;
        SH.ctx.save();
        SH.ctx.globalAlpha = fa;
        SH.ellipseFill(tr.x + 2, tr.y, 5 * fa + 2, 4 * fa + 1.5, '#ff8a1f');
        SH.ellipseFill(tr.x + 1, tr.y, 3 * fa + 1, 2.4 * fa + 1, '#ffd23f');
        SH.ellipseFill(tr.x, tr.y, 1.6 * fa + 0.6, 1.4 * fa + 0.6, '#ffffff');
        SH.ctx.restore();
      }
    }

    this.fx.forEach(function (f2) {
      if (f2.t < 0) return;                 /* staggered: not lit yet */
      var i = Math.min(f2.n - 1, Math.floor(f2.t / f2.dur * f2.n));
      SH.drawC(f2.sheet, i, f2.x, f2.y, {});
    });

    this.pops.forEach(function (p2) {
      var k3 = p2.t / p2.dur;
      SH.text(p2.text, p2.x, p2.y - k3 * 14,
              { color: p2.col, size: p2.size, align: 'center', alpha: 1 - k3 * k3 });
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
    var tpCol = this.tpFlash > 0 && Math.floor(this.tpFlash * 12) % 2 === 0
      ? '#ffffff' : '#7fdcff';
    SH.text('TP', 222, 4, { color: tpCol, size: 10 });
    SH.bar(238, 5, 46, 8, G.tp / G.maxtp, tpCol, '#0e2a38');
    /* the two spend thresholds, marked on the bar itself */
    SH.rect(238 + 46 * 0.4, 4, 1, 10, G.tp >= 40 ? '#c0ff3c' : '#3f5f6f');
    SH.text(Math.floor(G.tp) + '', 318, 4,
            { color: tpCol, size: 9, align: 'right' });
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
      var col = on ? BTN_ON : BTN_OFF;
      SH.rect(x, y, w, h, '#05050a');
      SH.frameRect(x, y, w, h, col, 2);
      SH.draw('hud', SH.frameOf('hud', b.icon + (on ? '_on' : ''), 0),
              x + 5, y + 3, { alpha: on ? 1 : 0.9 });
      SH.text(b.label, x + 24, y + 6, { color: col, size: 10, bold: true });
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
    /* the soul, wearing its graze outline when bullets are shaving past */
    if (!(this.soul.iframe > 0 && Math.floor(this.soul.iframe * 16) % 2 === 0)) {
      if (this.grazeGlow > 0) {
        var gg = this.grazeGlow * (0.72 + 0.28 * Math.sin(this.anim * 26));
        SH.ctx.save();
        SH.ctx.globalAlpha = gg * 0.3;
        SH.ellipseFill(this.soul.x, this.soul.y, 9, 9, '#7fdcff');
        SH.ctx.restore();
        SH.drawC('fx_soulring', 0, this.soul.x, this.soul.y, { alpha: gg });
      }
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
    var px = cx + SH.clamp(this.bar.x, -1.1, 1.1) * (b.w / 2 - 16);
    SH.rect(px - 2, y - 16, 4, 32, '#f2f2f8');
    SH.text('한 번만 지나간다 - 중앙에서 Z!', cx, b.y + 8,
            { color: '#9b9bb4', size: 9, align: 'center' });
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
    } else if (this.state === 'chaosfx') {
      SH.panel(8, 130, 304, 82, { fill: '#000', border: '#f2f2f8', lw: 2 });
    } else if (this.state === 'shooting') {
      SH.panel(8, 130, 304, 82, { fill: '#000', border: '#f2f2f8', lw: 2 });
      SH.text('사격!', SH.W / 2, 162, { color: '#ffd23f', size: 12, bold: true, align: 'center' });
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
