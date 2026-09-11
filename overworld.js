/* =====================================================================
   overworld.js - free map exploration between battles.

   This is the layer the design doc puts at the centre of the game:
   Shadow skates around a real tile map, walking triggers UNDERTALE-style
   random encounters, and every stage is locked behind the 2005 game's
   three parallel missions.  The exit gate does not open until one of
   DARK / HERO / NORMAL is satisfied, and whichever the player finished
   first is the choice story_branch.js records.
   ===================================================================== */
(function (SH) {
  'use strict';

  var TS = 16;

  /* boards, people and dropped data slates: readable as often as you
     like, and never mission objectives */
  var READABLE = { sign: 1, npc: 1, log: 1 };

  /* everything you can press Z on forever - the readables plus the
     scenery, which answers with a line and occasionally holds something */
  var EXAMINE = { sign: 1, npc: 1, log: 1, prop: 1 };

  /* Top speeds and how fast he gets there.  ACCEL is a hair under a second
     from a standstill to a full skate, which is the window the acceleration
     art needs to read; DECEL is much sharper so letting go still stops him
     where you expect. */
  var TOP_WALK = 106, TOP_DASH = 176;
  var ACCEL = 200, DECEL = 620;
  /* The Air Shoes light off a burn timer rather than raw speed: the speed
     ramp is under a second end to end, so staging the fire on it left the
     half-lit frame on screen for a quarter of a second and you never saw
     it.  Burn charges while skating (scaled by how fast he is actually
     going) and drains quickly when he stops, which puts a full second on
     the heel-vents stage. */
  /* Burn bleeds off SLOWLY once he stops, and never all the way back to
     cold: once the Air Shoes have been lit they stay warm, so pausing at a
     save point or reading a sign does not mean winding the whole thing up
     from nothing again. */
  var FIRE_1 = 0.35, FIRE_2 = 1.35, BURN_DRAIN = 0.45;
  /* the spin: a short roll you can trigger once he is at a full burn */
  var SPIN_TIME = 0.62, SPIN_BOOST = 1.4;
  /* the spin dash: hold down, tap Z or X to rev, let go to launch.  Six
     revs is a standing start straight into top speed. */
  var REV_MAX = 6, REV_DECAY = 1.4, SPIN_DASH_TIME = 0.55;

  function Overworld(mapId, opt) {
    opt = opt || {};
    this.mapId = mapId;
    this.map = SH.buildMap(mapId);
    this.def = this.map.def;
    this.cam = { x: 0, y: 0 };
    this.player = {
      x: this.map.spawn.x, y: this.map.spawn.y,
      vx: 0, vy: 0,
      face: 1,            // -1 / +1, only meaningful when dir === 'side'
      dir: 'down',        // 'side' | 'down' | 'up'
      anim: 0, moving: false, skating: false, spd: 0, charge: 0,
      burn: 0, spin: 0, rev: 0, revving: false, lit: false,
      ateConfirm: false
    };
    this.walked = 0;
    this.nextEnc = this.rollEncDistance();
    this.grace = 500;                 // safe distance on entering a map
    this.box = null;
    this.titleT = 2.2;
    this.gateOpen = false;
    this.firstCompleted = null;
    this.flashObj = null;
    this.encFlash = 0;
    this.pauseMenu = null;
    this.skipIntro = !!opt.skipIntro;
    this.progressRef = null;
  }

  /* ---------------- stage progress -------------------------------- */
  Overworld.prototype.progress = function () {
    var G = SH.Game;
    if (!G.stageProgress[this.mapId]) {
      G.stageProgress[this.mapId] = {
        kills: { human: 0, alien: 0, sonic: 0 },
        spares: 0,
        destroyed: { crate: 0, pod: 0 },
        terminals: 0,
        killedAnyone: false
      };
    }
    return G.stageProgress[this.mapId];
  };

  Overworld.prototype.objectiveDone = function (kind) {
    var m = this.def.mission[kind], p = this.progress();
    if (!m) return false;
    if (m.type === 'kill') {
      var n = p.kills[m.faction] || 0;
      if (m.faction === 'human') n += p.kills.sonic;
      return n >= m.count;
    }
    if (m.type === 'destroy') return (p.destroyed[m.kind] || 0) >= m.count;
    if (m.type === 'terminal') {
      if (m.pacifist && p.killedAnyone) return false;
      return p.terminals >= m.count;
    }
    return false;
  };

  Overworld.prototype.objectiveProgress = function (kind) {
    var m = this.def.mission[kind], p = this.progress();
    if (m.type === 'kill') {
      var n = (p.kills[m.faction] || 0) + (m.faction === 'human' ? p.kills.sonic : 0);
      return Math.min(n, m.count) + '/' + m.count;
    }
    if (m.type === 'destroy') return Math.min(p.destroyed[m.kind] || 0, m.count) + '/' + m.count;
    if (m.type === 'terminal') {
      if (m.pacifist && p.killedAnyone) return '실패';
      return Math.min(p.terminals, m.count) + '/' + m.count;
    }
    return '';
  };

  Overworld.prototype.refreshGate = function () {
    var kinds = ['dark', 'hero', 'normal'], wasOpen = this.gateOpen;
    for (var i = 0; i < kinds.length; i++) {
      if (this.objectiveDone(kinds[i])) {
        if (!this.firstCompleted) this.firstCompleted = kinds[i];
        this.gateOpen = true;
      }
    }
    if (this.gateOpen && !wasOpen) {
      SH.Audio.sfx('unlock');
      var label = { dark: 'DARK MISSION', hero: 'HERO MISSION', normal: 'NORMAL MISSION' }[this.firstCompleted];
      this.notice(label + ' 달성! 구역 봉쇄가 해제되었다.');
    }
  };

  Overworld.prototype.notice = function (text) {
    this.noticeText = text;
    this.noticeT = 3.0;
  };

  /* ---------------- lifecycle -------------------------------------- */
  Overworld.prototype.enter = function () {
    SH.Audio.play(this.def.bgm);
    SH.Game.currentMap = this.mapId;
    this.refreshGate();
    var self = this;
    if (!this.skipIntro && !SH.Game.seenIntro[this.mapId]) {
      SH.Game.seenIntro[this.mapId] = true;
      this.box = new SH.Textbox(this.def.intro, {
        onDone: function () { self.box = null; self.openingTips(); }
      });
    } else {
      this.openingTips();
    }
  };

  /* The whole overworld tutorial: four lines, once, on the first stage. */
  Overworld.prototype.openingTips = function () {
    SH.Tips.show('ow_move', '방향키로 이동한다.  X 를 누르고 있으면 스케이트로 가속.');
    SH.Tips.show('ow_mission', '미션을 하나라도 끝내야 출구 문이 열린다.  좌상단에 셋이 떠 있다.');
    SH.Tips.show('ow_act', '단말·상자·에메랄드는 물론, 길가의 기물도 Z 로 조사할 수 있다.');
    SH.Tips.show('ow_menu', 'C 로 메뉴와 설정. 이동 속도도 여기서 바꿀 수 있다.');
  };

  Overworld.prototype.resume = function () {
    SH.Audio.play(this.def.bgm);
    this.walked = 0;
    this.grace = 700;      // no ambush the moment a fight ends
    this.nextEnc = this.rollEncDistance();
    this.refreshGate();
  };

  /* ---------------- encounter pacing ---------------------------------
     UNDERTALE re-rolls a step counter after every fight, over a wide band:
     a couple of quick ones and then a long quiet stretch is the point.  A
     narrow band made these maps feel metronomic - you could count to the
     next fight.  `rate` is the mean distance; the roll spans 0.8x to 3.2x
     of it, so at walking pace the gap runs from roughly eight seconds to
     over half a minute. */
  Overworld.prototype.rollEncDistance = function () {
    return this.def.encounter.rate * (0.8 + Math.random() * 2.4);
  };

  /* ---------------- collision --------------------------------------- */
  Overworld.prototype.solidAt = function (px, py) {
    var tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return true;
    var c = this.map.grid[ty][tx];
    if (this.def.solid.indexOf(c) >= 0) return true;
    /* closed gate blocks the way through */
    for (var i = 0; i < this.map.objects.length; i++) {
      var o = this.map.objects[i];
      /* the exit is a 2x3-tile door; the whole shutter blocks when locked */
      if (o.kind === 'gate' && !this.gateOpen &&
          tx >= o.tx && tx <= o.tx + 1 && ty >= o.ty - 2 && ty <= o.ty) return true;
      if ((o.kind === 'crate' || o.kind === 'pod') && o.alive && o.tx === tx && o.ty === ty) return true;
    }
    return false;
  };

  Overworld.prototype.tryMove = function (dx, dy) {
    var p = this.player, r = 5;
    if (dx) {
      var nx = p.x + dx;
      if (!this.solidAt(nx + Math.sign(dx) * r, p.y - 2) &&
          !this.solidAt(nx + Math.sign(dx) * r, p.y + r)) p.x = nx;
    }
    if (dy) {
      var ny = p.y + dy;
      if (!this.solidAt(p.x - r, ny + Math.sign(dy) * r) &&
          !this.solidAt(p.x + r, ny + Math.sign(dy) * r)) p.y = ny;
    }
  };

  /* ---------------- interaction --------------------------------------- */
  Overworld.prototype.nearObject = function () {
    var p = this.player, best = null, bd = 24 * 24, prop = null, pd = 20 * 20;
    this.map.objects.forEach(function (o) {
      var dx = o.x - p.x, dy = o.y - p.y, d = dx * dx + dy * dy;
      /* Scenery is ranked apart and only wins when nothing else is in
         reach: there are hundreds of props per stage, and a lamp post
         stealing the prompt off a terminal would be maddening. */
      if (o.kind === 'prop') {
        if (d < pd) { pd = d; prop = o; }
        return;
      }
      if (o.kind !== 'gate' && o.kind !== 'save' && !EXAMINE[o.kind] &&
          (o.used || !o.alive)) return;
      if (d < bd) { bd = d; best = o; }
    });
    return best || prop;
  };

  Overworld.prototype.interact = function () {
    var o = this.nearObject(), self = this, P = this.progress();
    if (!o) return;

    /* Boards and bystanders: read as often as you like, never an objective.
       They are where the plot lives between missions. */
    if (o.kind === 'sign' || o.kind === 'npc' || o.kind === 'log') {
      var lore = (SH.MapLore[this.mapId] || {})[o.kind] || [];
      var body = lore[o.loreIndex % (lore.length || 1)] ||
                 ['…아무것도 적혀 있지 않다.'];
      SH.Audio.sfx(o.kind === 'npc' ? 'text' : 'confirm');
      this.box = new SH.Textbox(body.map(function (t) { return { text: t }; }),
                                { onDone: function () { self.box = null; } });
      SH.Tips.show('ow_read', '표지판과 사람들에게는 읽을 것이 있다.  미션과는 상관없다.');
      return;
    }

    if (o.kind === 'prop') { this.examineProp(o); return; }

    if (o.kind === 'terminal') {
      o.used = true;
      P.terminals++;
      SH.Audio.sfx('unlock');
      this.refreshGate();
      var msgs = {
        westopolis: '대피 신호기를 켰다. 시민들이 지하로 내려간다.',
        glyphic_canyon: '봉인석에 손을 얹자 고대 문양이 빛났다.',
        ark: 'ARK 관제 단말이 되살아났다. 50년 전 로그가 흐른다.',
        gun_fortress: '경비 단말을 무력화했다. 경보가 멎었다.',
        black_comet: '혜성의 신경절이 잠잠해졌다.'
      };
      this.box = new SH.Textbox([{ text: msgs[this.mapId] || '단말을 작동시켰다.' }],
                                { onDone: function () { self.box = null; } });
      return;
    }

    if (o.kind === 'crate' || o.kind === 'pod') {
      o.alive = false;
      P.destroyed[o.kind]++;
      SH.Audio.sfx('kill');
      SH.shake(4, 0.25);
      this.refreshGate();
      var t = o.kind === 'crate'
        ? 'G.U.N. 보급 컨테이너를 부쉈다. 인류의 보급선이 하나 끊겼다.'
        : '블랙 암즈 산란낭을 태워버렸다. 혜성의 증식이 늦춰졌다.';
      this.box = new SH.Textbox([{ text: t }], { onDone: function () { self.box = null; } });
      return;
    }

    if (o.kind === 'emerald') {
      o.used = true;
      var first = SH.Game.emeraldCount() === 0;
      SH.Game.giveEmerald();
      SH.Audio.sfx('pickup');
      SH.flash('#7fdcff', 0.25);
      var lines = [{
        who: '섀도우', face: 'face_shadow',
        text: '카오스 에메랄드... ' + SH.Game.emeraldCount() + '개째다.'
      }];
      /* the emeralds are what the Chaos moves run on, so the first one is
         also the moment they become usable at all */
      if (first) {
        lines.push({ who: '섀도우', face: 'face_shadow',
                     text: '이 힘이라면… 카오스 컨트롤을 쓸 수 있다.' });
        lines.push({ text: '카오스 스피어 · 카오스 블래스트 · 카오스 컨트롤이 해금되었다.' });
      }
      if (SH.Game.emeraldCount() >= 7) {
        lines.push({ text: '일곱 개가 모두 모였다.  진정한 결말로 가는 길이 열려 있다.' });
      }
      this.box = new SH.Textbox(lines, { onDone: function () { self.box = null; } });
      return;
    }

    if (o.kind === 'save') {
      var key = this.mapId + ':' + o.tx + ',' + o.ty;
      SH.Game.lastSave = key;
      SH.Game.hp = SH.Game.maxhp;
      var ok = SH.Game.save();
      SH.Audio.sfx('unlock');
      SH.flash('#ffd23f', 0.2);
      SH.Tips.show('ow_save', '세이브 포인트다.  여기서 저장하면 HP 도 전부 회복된다.');
      this.box = new SH.Textbox([{
        who: '섀도우', face: 'face_shadow',
        text: ok ? '...기록했다. 체력도 돌아왔다.' : '기록에 실패했다. 브라우저 저장이 막혀 있다.'
      }], { onDone: function () { self.box = null; } });
      return;
    }

    if (o.kind === 'gate') {
      if (!this.gateOpen) {
        SH.Audio.sfx('deny');
        SH.Tips.show('ow_gate', '이 문은 미션을 하나라도 끝내야 열린다.  아래 셋 중 아무거나 달성하면 된다.');
        var lines = [{ text: '구역 봉쇄. 아래 미션 중 하나를 달성해야 통과할 수 있다.' }];
        lines.push({ text:
          '[DARK]   ' + this.def.mission.dark.text + '  (' + this.objectiveProgress('dark') + ')\n' +
          '[HERO]   ' + this.def.mission.hero.text + '  (' + this.objectiveProgress('hero') + ')\n' +
          '[NORMAL] ' + this.def.mission.normal.text + '  (' + this.objectiveProgress('normal') + ')' });
        this.box = new SH.Textbox(lines, { onDone: function () { self.box = null; } });
      } else {
        this.leaveStage();
      }
    }
  };

  /* ---------------- scenery -------------------------------------------
     Every prop on the map answers to Z.  Most of them only have a line to
     give, but the map hash picks out a scattered few that hold an item,
     a bench can be sat on once, and a cold brazier can be set burning -
     enough that pressing Z on the way past is worth doing.  The answer
     goes through notice(), not a textbox, so none of it interrupts a run.
     ------------------------------------------------------------------ */

  /* Stable per-prop number: the same lamp always says the same thing and
     always either holds something or does not, across save loads. */
  Overworld.prototype.propHash = function (o) {
    var h = o.tx * 73 + o.ty * 151 + this.mapId.length * 17;
    h ^= (h >> 3);
    return (h < 0 ? -h : h);
  };

  Overworld.prototype.examineProp = function (o) {
    var info = SH.PropLore[o.prop] || {}, G = SH.Game;
    var h = this.propHash(o);
    if (this.bumped && this.bumped !== o) this.bumped.bump = 0;
    o.bump = 0.3;                      /* a visible nudge, so it reacted */
    this.bumped = o;
    o.reads = (o.reads || 0) + 1;

    /* contents first - the payoff beats the flavour line */
    var loot = info.loot;
    if (loot && h % loot.odds === 0) {
      if (o.looted) {
        SH.Audio.sfx('deny');
        this.notice(loot.after);
        return;
      }
      if (G.items.length >= 8) {
        SH.Audio.sfx('deny');
        this.notice('가방이 가득 찼다.  ' + SH.Items[loot.item].name + ' 은(는) 두고 간다.');
        return;
      }
      o.looted = true;
      G.items.push(loot.item);
      SH.Audio.sfx('pickup');
      SH.flash('#ffd23f', 0.14);
      SH.Tips.show('ow_search', '기물 중 일부는 뒤지면 아이템이 나온다.  전부는 아니다.');
      this.notice(loot.text + '   (' + SH.Items[loot.item].name + ')');
      return;
    }

    /* sit down once - and only on the benches the hash picks, so a city
       full of them is not a city full of free healing */
    if (info.rest && h % info.rest.odds === 0) {
      if (G.hp >= G.maxhp) {
        SH.Audio.sfx('deny');
        this.notice(info.rest.full);
        return;
      }
      if (!o.rested) {
        o.rested = true;
        G.hp = Math.min(G.maxhp, G.hp + info.rest.hp);
        SH.Audio.sfx('heal');
        SH.flash('#8effa2', 0.12);
        this.notice(info.rest.text + '   (HP +' + info.rest.hp + ')');
        return;
      }
    }

    /* set it burning, and leave it burning */
    if (info.light) {
      if (!o.lit) {
        o.lit = true;
        SH.Audio.sfx('chaos');
        SH.flash('#ff9a2e', 0.16);
        this.notice(info.light.text);
        return;
      }
      SH.Audio.sfx('confirm');
      this.notice(info.light.lit);
      return;
    }

    /* one-shot bit of business, then the ordinary lines */
    if (info.pickup && o.reads === 1) {
      SH.Audio.sfx('text');
      this.notice(info.pickup);
      return;
    }

    var look = info.look || ['...특별할 것은 없다.'];
    SH.Audio.sfx('confirm');
    this.notice(o.reads > 1 && info.again ? info.again
                                          : look[h % look.length]);
  };

  Overworld.prototype.leaveStage = function () {
    var self = this;
    var chosen = this.firstCompleted || 'normal';
    SH.Story.recordStage(this.mapId, chosen);
    SH.Audio.sfx('confirm');
    SH.fadeOut(0.5, function () {
      SH.pop();
      SH.Game.onStageCleared(self.mapId, self.def.next, chosen);
    });
  };

  /* ---------------- encounters ---------------------------------------- */
  Overworld.prototype.rollGroup = function () {
    var table = this.def.encounter.table;
    var n = SH.chance(0.55) ? 1 : (SH.chance(0.75) ? 2 : 3);
    var ids = [];
    for (var i = 0; i < n; i++) ids.push(SH.rollEncounter(table));
    return ids;
  };

  Overworld.prototype.triggerEncounter = function () {
    var self = this;
    this.walked = 0;
    this.nextEnc = this.rollEncDistance();
    this.encFlash = 0.45;
    SH.Tips.show('ow_encounter', '이동 중에는 적과 조우한다.  전투는 턴제다.');
    SH.Audio.sfx('encounter');
    SH.flash('#f2f2f8', 0.25);
    var ids = this.rollGroup();
    SH.fadeOut(0.45, function () {
      SH.startBattle(ids, {
        onEnd: function (res) { self.afterBattle(res); }
      });
      SH.fadeIn(0.35);
    });
  };

  Overworld.prototype.afterBattle = function (res) {
    var P = this.progress(), self = this;
    res.enemies.forEach(function (e) {
      if (e.dead) {
        P.kills[e.faction] = (P.kills[e.faction] || 0) + 1;
        P.killedAnyone = true;
      } else if (e.spared) {
        P.spares++;
      }
    });
    this.refreshGate();

    if (res.outcome === 'lose') {
      SH.Game.gameOver();
      return;
    }
    /* the occasional pick-up keeps a long stage survivable */
    if (SH.chance(0.35)) {
      var it = SH.chance(0.6) ? 'ring' : 'chaos_drive';
      if (SH.Game.items.length < 8) {
        SH.Game.items.push(it);
        this.notice(SH.Items[it].name + ' 을(를) 손에 넣었다.');
      }
    }
  };

  /* ---------------- update ---------------------------------------------- */
  Overworld.prototype.update = function (dt) {
    var G = SH.Game;
    if (this.titleT > 0) this.titleT -= dt;
    if (this.noticeT > 0) this.noticeT -= dt;
    if (this.encFlash > 0) this.encFlash -= dt;
    if (this.bumped) {
      this.bumped.bump -= dt;
      if (this.bumped.bump <= 0) { this.bumped.bump = 0; this.bumped = null; }
    }

    if (this.box) { this.box.update(dt); return; }
    if (SH.isFading()) return;

    if (SH.Input.pressed('menu')) {
      SH.push(SH.makePauseMenu(this));
      return;
    }

    var ax = SH.Input.axis();
    /* with 항상 대시 on, the key inverts into a precision walk */
    var dash = SH.Input.down('cancel') !== SH.Settings.autoDash;
    var p = this.player;
    p.moving = !!(ax.x || ax.y);
    p.skating = p.moving && dash;

    /* --- spin dash ------------------------------------------------------
       Standing still with down held is the charge stance: every tap of Z or
       X winds him up one turn, and letting go of down fires him off.  It is
       gated on standing still so it never competes with the rolling spin
       below, which is the moving-at-speed version. */
    /* The stance begins on the first TAP, not on down alone - down on its
       own still just walks him toward the camera, which is most of what
       the key is for. */
    var downHeld = p.spin <= 0 && SH.Input.down('down') && !ax.x;
    var tap = downHeld && (SH.Input.pressed('confirm') || SH.Input.pressed('cancel'));
    var revStance = downHeld && (p.revving || tap);
    if (revStance) {
      p.revving = true;
      p.moving = false;
      p.skating = false;
      if (tap) {
        p.rev = Math.min(REV_MAX, p.rev + 1);
        p.ateConfirm = true;          /* so the tap does not also interact */
        SH.Audio.sfx('rev');
        SH.shake(1 + p.rev * 0.3, 0.08);
        SH.Tips.show('ow_revdash',
          '↓ 를 누른 채 Z / X 를 연타하면 스핀 대시.  6번이면 최고 속도로 튀어나간다.');
      }
      /* an untended charge unwinds rather than holding forever */
      p.rev = Math.max(0, p.rev - dt * REV_DECAY * 0.35);
      ax = { x: 0, y: 0 };
    } else if (p.revving) {
      p.revving = false;
      var wind = Math.round(p.rev);
      p.rev = 0;
      if (wind > 0) {
        p.spin = SPIN_DASH_TIME + wind * 0.09;
        /* six turns is a standing start straight into top speed */
        p.spd = TOP_DASH * (0.45 + 0.55 * Math.min(1, wind / REV_MAX));
        p.burn = FIRE_2;                  /* comes out of it fully lit */
        p.lit = true;
        SH.Audio.sfx('chaos');
        SH.shake(4, 0.18);
      }
    }

    /* Rolling.  It keeps the heading he already had, so it never fights the
       D-pad for a turn, it carries itself once started, and nothing can jump
       him mid-roll.  Pushing the stick the way he is already going uncurls
       him straight back into the skate. */
    if (p.spin > 0) {
      p.spin = Math.max(0, p.spin - dt);
      p.moving = true;
      p.skating = true;
      /* A fresh PRESS of the way he is going uncurls him.  Testing the
         held axis instead cancelled the roll on the very next frame, since
         the direction you were already running is still down. */
      if (SH.Input.pressed(p.face > 0 ? 'right' : 'left')) {
        p.spin = 0;                       /* uncurl, back on the shoes */
        p.burn = Math.max(p.burn, FIRE_2);
      }
    } else if (!revStance && p.skating && p.burn >= FIRE_2 &&
               ax.x !== 0 && SH.Input.pressed('down')) {
      /* Left or right has to be HELD for down to mean "roll".  Firing it on
         down alone meant that from a standstill - or any time you simply
         wanted to walk toward the camera - he curled up instead.  Standing
         still, down does nothing at all now; the spin dash is the standing
         version of the move. */
      p.spin = SPIN_TIME;
      SH.Audio.sfx('chaos');
    }

    /* Speed ramps the way it does in the series - you do not get top speed
       for free the instant you touch the key, you build to it. */
    var top = p.moving ? (dash ? TOP_DASH : TOP_WALK) : 0;
    if (p.spin > 0) top = TOP_DASH;
    if (p.spd < top) p.spd = Math.min(top, p.spd + ACCEL * dt);
    else if (p.spd > top) p.spd = Math.max(top, p.spd - DECEL * dt);
    p.charge = SH.clamp(p.spd / TOP_DASH, 0, 1);
    if (p.skating) {
      p.burn += dt * p.charge;
      /* tell them about the spin when they first hit a full burn, not after
         they have already stumbled into it */
      if (p.burn >= FIRE_2) {
        SH.Tips.show('ow_spin',
          '에어 슈즈가 완전히 점화됐다.  이 상태에서 ↓ 를 누르면 스핀 (조우 무시).');
      }
    } else {
      /* the floor is the heel-vent stage once he has ever been fully lit */
      p.burn = Math.max(p.lit ? FIRE_1 : 0, p.burn - dt * BURN_DRAIN);
    }
    if (p.burn >= FIRE_2) p.lit = true;

    var speed = p.spd * SH.Settings.speedMul() * dt;
    if (p.spin > 0) speed *= SPIN_BOOST;
    if (ax.x && ax.y) speed *= 0.72;
    /* horizontal input wins the facing, so a diagonal keeps the profile */
    if (p.spin > 0) { ax = { x: p.face, y: 0 }; }
    else if (ax.x) { p.dir = 'side'; p.face = ax.x > 0 ? 1 : -1; }
    else if (ax.y) p.dir = ax.y > 0 ? 'down' : 'up';
    if (p.moving) {
      this.tryMove(ax.x * speed, 0);
      this.tryMove(0, ax.y * speed);
      /* The skate cycle runs SLOWER than the walk, not faster.  Driving it
         at dash speed churned the feet three times a second, which reads as
         sprinting; a skater pushes about once a second and glides between
         pushes, and the ground speed comes from the glide, not the legs. */
      p.anim += dt * (p.skating ? 4.2 : 9);
      /* divided by the speed setting so 매우 빠름 covers more map per
         encounter instead of running into more of them */
      var dist = speed * Math.hypot(ax.x, ax.y) / SH.Settings.speedMul();
      if (p.spin > 0) dist = 0;               /* rolling, nothing can jump him */
      if (this.grace > 0) this.grace -= dist;
      else {
        this.walked += dist;
        if (this.walked >= this.nextEnc) this.triggerEncounter();
      }
    }

    if (SH.Input.pressed('confirm') && !p.ateConfirm) this.interact();
    p.ateConfirm = false;
    if (this.nearObject()) SH.Tips.show('ow_prompt', 'Z 표시가 뜬 곳은 전부 조사할 수 있다.  간판도, 사람도, 길가의 기물도.');

    /* camera */
    var cw = SH.W, chh = SH.H;
    this.cam.x = SH.clamp(p.x - cw / 2, 0, Math.max(0, this.map.pxw - cw));
    this.cam.y = SH.clamp(p.y - chh / 2, 0, Math.max(0, this.map.pxh - chh));
  };

  /* ---------------- draw -------------------------------------------------- */
  /* Is the tile at (tx, ty) something you can stand on? */
  Overworld.prototype.walkTile = function (tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return false;
    return this.def.solid.indexOf(this.map.grid[ty][tx]) < 0;
  };

  Overworld.prototype.drawTiles = function () {
    var cx = Math.floor(this.cam.x), cy = Math.floor(this.cam.y);
    var x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS);
    var x1 = Math.min(this.map.w - 1, x0 + Math.ceil(SH.W / TS) + 1);
    var y1 = Math.min(this.map.h - 1, y0 + Math.ceil(SH.H / TS) + 1);
    var y, x;
    for (y = Math.max(0, y0); y <= y1; y++) {
      for (x = Math.max(0, x0); x <= x1; x++) {
        var ch = this.map.grid[y][x];
        var name = this.def.legend[ch] || this.def.legend[this.def.floor] || 'void';
        SH.draw('tiles', SH.frameOf('tiles', name, 0), x * TS - cx, y * TS - cy);
      }
    }

    /* Mark where the floor ends.  Which tiles you can run on was guesswork
       from the art alone - some walls are darker than some floors and the
       stage palettes differ - so every boundary between a solid tile and a
       walkable one gets drawn: a lit cap along the top of the wall and a
       shadow cast onto the floor beside it. */
    var ctx = SH.ctx;
    for (y = Math.max(0, y0); y <= y1; y++) {
      for (x = Math.max(0, x0); x <= x1; x++) {
        if (this.walkTile(x, y)) continue;
        var px = x * TS - cx, py = y * TS - cy;
        if (this.walkTile(x, y - 1)) {           // lit cap, and its shadow
          ctx.save();
          ctx.globalAlpha = 0.85;
          SH.rect(px, py, TS, 1, '#d6dcf0');
          ctx.globalAlpha = 0.30;
          SH.rect(px, py - 2, TS, 2, '#000000');
          ctx.restore();
        }
        if (this.walkTile(x, y + 1)) {           // the wall's own shadow
          ctx.save();
          ctx.globalAlpha = 0.42;
          SH.rect(px, py + TS, TS, 3, '#000000');
          ctx.restore();
        }
        if (this.walkTile(x - 1, y)) {
          ctx.save();
          ctx.globalAlpha = 0.30;
          SH.rect(px - 2, py, 2, TS, '#000000');
          ctx.globalAlpha = 0.55;
          SH.rect(px, py, 1, TS, '#8d93ad');
          ctx.restore();
        }
        if (this.walkTile(x + 1, y)) {
          ctx.save();
          ctx.globalAlpha = 0.30;
          SH.rect(px + TS, py, 2, TS, '#000000');
          ctx.globalAlpha = 0.55;
          SH.rect(px + TS - 1, py, 1, TS, '#8d93ad');
          ctx.restore();
        }
      }
    }
  };

  Overworld.prototype.drawObjects = function () {
    var cx = Math.floor(this.cam.x), cy = Math.floor(this.cam.y), self = this;
    this.map.objects.forEach(function (o) {
      var x = o.x - 8 - cx, y = o.y - 8 - cy;
      if (x < -TS || y < -TS || x > SH.W || y > SH.H) return;
      if (o.kind !== 'gate' && !(o.used || !o.alive)) {
        var big = o.kind === 'save' || o.kind === 'sign' ||
                  o.kind === 'npc' || o.kind === 'prop';
        SH.groundShadow(o.x - cx, o.y - cy + (big ? 9 : 7),
                        big ? 9 : 6, big ? 3 : 2.2, 0.34);
      }
      if (o.kind === 'gate') {
        /* 32x48: two tiles wide, three tall, anchored on its bottom tile */
        SH.draw('door', SH.frameOf('door', self.gateOpen ? 'open' : 'locked', 0),
                o.tx * 16 - cx, (o.ty - 2) * 16 - cy);
        if (self.gateOpen) {
          SH.draw('tiles', SH.frameOf('tiles', 'goal_ring', 0), o.tx * 16 + 8 - cx,
                  (o.ty - 1) * 16 - cy + Math.sin(SH.time * 3) * 1.5, { alpha: 0.9 });
        }
      } else if (o.kind === 'save') {
        var lit = SH.Game.lastSave === self.mapId + ':' + o.tx + ',' + o.ty;
        SH.draw('savepoint', SH.frameOf('savepoint', lit ? 'lit' : 'idle', 0),
                o.x - 12 - cx, o.y - 26 - cy + Math.sin(SH.time * 2 + o.tx) * 1.2);
      } else if (o.kind === 'terminal') {
        SH.draw('tiles', SH.frameOf('tiles', o.used ? 'terminal_on' : 'terminal_off', 0), x, y);
      } else if (o.kind === 'crate') {
        if (o.alive) SH.draw('tiles', SH.frameOf('tiles', 'crate', 0), x, y);
      } else if (o.kind === 'pod') {
        if (o.alive) SH.draw('tiles', SH.frameOf('tiles', 'alien_pod', 0), x, y);
      } else if (o.kind === 'emerald') {
        if (!o.used) {
          SH.draw('hud', SH.frameOf('hud', SH.Game.emeraldSpriteFor(o), 0),
                  x, y + Math.sin(SH.time * 2.5 + o.tx) * 2);
        }
      } else if (o.kind === 'sign') {
        var near = self.nearObject() === o;
        SH.draw('signpost', SH.frameOf('signpost', near ? 'lit' : 'idle', 0),
                o.x - 8 - cx, o.y - 16 - cy);
      } else if (o.kind === 'prop') {
        /* a short hop when it is pressed, so scenery visibly answers */
        var hop = o.bump > 0 ? Math.sin(o.bump / 0.3 * Math.PI) * 2 : 0;
        SH.draw('props', SH.frameOf('props', o.prop, 0),
                x, o.y - 16 - cy - Math.round(hop));
        if (o.lit) {
          SH.draw('fx_flare', ((SH.time * 12 + o.tx) | 0) % 4,
                  o.x - 12 - cx, o.y - 27 - cy - Math.round(hop),
                  { alpha: 0.85 });
        }
      } else if (o.kind === 'log') {
        var nearL = self.nearObject() === o;
        SH.draw('datalog', SH.frameOf('datalog', nearL ? 'lit' : 'idle', 0),
                x, y + Math.sin(SH.time * 2 + o.tx) * 1.2);
      } else if (o.kind === 'npc') {
        var who = ['a', 'b', 'c'][(o.variant || 0) % 3];
        SH.draw('civilian', SH.frameOf('civilian', who, (SH.time * 2 + o.tx) | 0),
                o.x - 8 - cx, o.y - 16 - cy);
      }
      /* interaction prompt */
      var readable = !!EXAMINE[o.kind];
      if (self.nearObject() === o &&
          (readable || !(o.used || !o.alive) || o.kind === 'gate')) {
        SH.text('Z', o.x - cx, o.y - cy - (o.kind === 'log' ? 18 : (readable ? 26 : 20)),
                { color: '#ffd23f', size: 9, align: 'center' });
      }
    });
  };

  Overworld.prototype.drawPlayer = function () {
    var p = this.player;
    var x = p.x - Math.floor(this.cam.x), y = p.y - Math.floor(this.cam.y) + 6;
    /* an elliptical drop shadow anchors the sprite to the floor; it
       tightens up while skating, when he is riding lower and faster */
    var sq = p.skating ? 1.15 : 1.0;
    SH.groundShadow(x, y - 1, 7 * sq, 2.6, p.skating ? 0.34 : 0.42);
    /* the compact overworld build - the 40x44 battle sprite is nearly
       three tiles tall and swamps the map */
    var sheet = SH.Game.superForm ? 'shadow_super_ow' : 'shadow_ow';
    var pre = p.dir === 'down' ? 'down_' : (p.dir === 'up' ? 'up_' : '');
    var anim, phase;
    if (p.revving && p.rev > 0.2) {
      /* winding up: the ball on the spot, shaking harder the tighter the
         spring is wound */
      anim = pre + 'spin';
      phase = SH.time * (14 + p.rev * 5);
      x += Math.round(Math.sin(SH.time * 60) * (0.5 + p.rev * 0.35));
    } else if (p.spin > 0) { anim = pre + 'spin'; phase = p.anim * 2; }
    else if (p.skating) {
      var lvl = p.burn >= FIRE_2 ? 2 : (p.burn >= FIRE_1 ? 1 : 0);
      anim = pre + 'skate' + lvl;
      phase = p.anim;
    }
    else if (p.moving) { anim = pre + 'walk'; phase = p.anim; }
    else { anim = pre + 'idle'; phase = SH.time * 3; }
    var f = SH.frameOf(sheet, anim, phase);
    /* only the side view is mirrored; front and back are symmetric */
    SH.drawFoot(sheet, f, x, y + 1, { flip: p.dir === 'side' && p.face < 0 });
  };

  Overworld.prototype.drawHUD = function () {
    var G = SH.Game;
    /* mission panel - dimmed while a tip is up, since they share the top */
    var w = 196, h = 50;
    SH.ctx.save();
    SH.ctx.globalAlpha = SH.Tips.active() ? 0.18 : 0.86;
    SH.rect(4, 4, w, h, '#05050a');
    SH.ctx.restore();
    SH.frameRect(4, 4, w, h, this.gateOpen ? '#7dff9b' : '#4a4a68', 1);
    if (SH.Tips.active()) { SH.ctx.restore(); return; }
    SH.ctx.restore();
    SH.ctx.save();
    SH.text('MISSION - ' + this.def.name, 9, 7, { color: '#ffd23f', size: 9 });
    var M = this.def.mission;
    var rows = [
      ['DARK', M.dark.short || M.dark.text, this.objectiveProgress('dark'), 'dark'],
      ['HERO', M.hero.short || M.hero.text, this.objectiveProgress('hero'), 'hero'],
      ['NORM', M.normal.short || M.normal.text, this.objectiveProgress('normal'), 'normal']
    ];
    var self = this;
    rows.forEach(function (r, i) {
      var done = self.objectiveDone(r[3]);
      var col = done ? '#7dff9b' : (r[2] === '실패' ? '#6e5560' : '#c9c9dd');
      SH.text((done ? '■ ' : '□ ') + r[0], 9, 19 + i * 10, { color: col, size: 8 });
      SH.text(r[1], 50, 19 + i * 10, { color: col, size: 8 });
      SH.rect(w - 26, 18 + i * 10, 26, 9, '#05050a');
      SH.text(r[2], w - 2, 19 + i * 10, { color: col, size: 8, align: 'right' });
    });

    /* status strip */
    var y = SH.H - 16;
    SH.ctx.save();
    SH.ctx.globalAlpha = 0.86;
    SH.rect(0, y, SH.W, 16, '#05050a');
    SH.ctx.restore();
    SH.text('HP', 6, y + 4, { color: '#f2f2f8', size: 9 });
    SH.bar(22, y + 5, 52, 7, G.hp / G.maxhp, '#d8232f', '#3a0d12');
    SH.text(Math.ceil(G.hp) + '/' + G.maxhp, 78, y + 4, { color: '#f2f2f8', size: 8 });
    SH.draw('hud', SH.frameOf('hud', 'ring', 0), 118, y);
    SH.text('x' + G.rings, 134, y + 4, { color: '#ffd23f', size: 9 });
    SH.text('EMERALD', 176, y + 4, { color: '#7fdcff', size: 8 });
    for (var i = 0; i < 7; i++) {
      var on = G.emeralds[i];
      SH.ctx.save();
      SH.ctx.globalAlpha = on ? 1 : 0.22;
      SH.draw('hud', SH.frameOf('hud', ['emerald_cyan', 'emerald_yellow', 'emerald_green',
        'emerald_blue', 'emerald_purple', 'emerald_red', 'emerald_white'][i], 0),
        222 + i * 13, y + 1, { scale: 0.75 });
      SH.ctx.restore();
    }
  };

  Overworld.prototype.draw = function () {
    SH.clear('#05050a');
    this.drawTiles();
    this.drawObjects();
    this.drawPlayer();
    this.drawHUD();

    if (this.titleT > 0) {
      var a = SH.clamp(this.titleT / 0.5, 0, 1);
      SH.ctx.save();
      SH.ctx.globalAlpha = a;
      SH.rect(0, 88, SH.W, 46, '#05050a');
      SH.text(this.def.name, SH.W / 2, 96, { color: '#f2f2f8', size: 16, bold: true, align: 'center' });
      SH.text(this.def.subtitle, SH.W / 2, 116, { color: '#d8232f', size: 10, align: 'center' });
      SH.ctx.restore();
    }
    if (this.noticeT > 0) {
      SH.ctx.save();
      SH.ctx.globalAlpha = SH.clamp(this.noticeT, 0, 1);
      SH.rect(20, 60, SH.W - 40, 18, '#05050a');
      SH.frameRect(20, 60, SH.W - 40, 18, '#ffd23f', 1);
      SH.text(this.noticeText, SH.W / 2, 65, { color: '#ffd23f', size: 9, align: 'center' });
      SH.ctx.restore();
    }
    if (this.encFlash > 0) {
      SH.text('!', this.player.x - this.cam.x, this.player.y - this.cam.y - 48,
              { color: '#ffd23f', size: 20, bold: true, align: 'center' });
    }
    if (this.box) this.box.draw();
  };

  SH.Overworld = Overworld;
  SH.enterMap = function (id, opt) { SH.push(new Overworld(id, opt)); };
})(window.SH = window.SH || {});
