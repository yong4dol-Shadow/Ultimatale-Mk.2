/* =====================================================================
   main.js - boot, global save state, scene flow and the finale.

   Scene order
     Title -> (prologue) -> Overworld(stage) <-> Battle
           -> finale decided by story_branch -> Ending
           -> [LAST STORY] once ENDING 3 was cleared with 7 emeralds
   ===================================================================== */
(function (SH) {
  'use strict';

  var SAVE_KEY = 'shadow_the_hedgehog_16bit_v1';
  var OPT_KEY = 'shadow_the_hedgehog_16bit_options';
  var EMERALD_SPRITES = ['emerald_cyan', 'emerald_yellow', 'emerald_green',
                         'emerald_blue', 'emerald_purple', 'emerald_red', 'emerald_white'];
  var EXP_TABLE = [0, 12, 32, 70, 130, 210, 320, 470, 660, 900, 1250];

  /* ==================================================================
     options - kept apart from the save file so they survive a new game
     ================================================================== */
  var MOVE_SPEEDS = [
    { label: '보통', mul: 1.00 },
    { label: '빠름', mul: 1.35 },
    { label: '매우 빠름', mul: 1.75 }
  ];
  var TEXT_SPEEDS = [
    { label: '보통', cps: 42 },
    { label: '빠름', cps: 75 },
    { label: '즉시', cps: 9999 }
  ];

  var Settings = SH.Settings = {
    move: 0,            // index into MOVE_SPEEDS
    text: 0,            // index into TEXT_SPEEDS
    autoDash: false,    // move at dash speed without holding the key
    tips: true,         // show the one-line tutorial prompts
    seenTips: {},       // tip id -> true, so each one only fires once

    speedMul: function () { return MOVE_SPEEDS[this.move].mul; },
    textCps: function () { return TEXT_SPEEDS[this.text].cps; },

    load: function () {
      try {
        var d = JSON.parse(localStorage.getItem(OPT_KEY) || '{}');
        if (typeof d.move === 'number') this.move = SH.clamp(d.move | 0, 0, MOVE_SPEEDS.length - 1);
        if (typeof d.text === 'number') this.text = SH.clamp(d.text | 0, 0, TEXT_SPEEDS.length - 1);
        this.autoDash = !!d.autoDash;
        this.tips = d.tips !== false;
        this.seenTips = d.seenTips || {};
      } catch (e) { /* defaults are fine */ }
    },
    save: function () {
      try {
        localStorage.setItem(OPT_KEY, JSON.stringify({
          move: this.move, text: this.text, autoDash: this.autoDash,
          tips: this.tips, seenTips: this.seenTips
        }));
      } catch (e) { /* private mode - keep the in-memory values */ }
    },

    /* a reusable menu of the options, shared by the title and the pause menu */
    menuItems: function () {
      var self = this;
      return [
        { label: '이동 속도', right: '◀ ' + MOVE_SPEEDS[this.move].label + ' ▶',
          value: 'move', desc: '오버월드 기본 이동 속도.' },
        { label: '항상 대시', right: '◀ ' + (this.autoDash ? '켜짐' : '꺼짐') + ' ▶',
          value: 'autoDash',
          desc: this.autoDash ? 'X 를 누르면 오히려 천천히 걷는다.' : 'X 를 눌러야 빨라진다.' },
        { label: '텍스트 속도', right: '◀ ' + TEXT_SPEEDS[this.text].label + ' ▶',
          value: 'text', desc: '대사가 표시되는 속도.' },
        { label: '튜토리얼', right: '◀ ' + (this.tips ? '켜짐' : '꺼짐') + ' ▶',
          value: 'tips', desc: '조작 안내를 한 줄씩 띄운다.' },
        { label: '튜토리얼 초기화', right: '  Z', value: 'resetTips',
          desc: '이미 본 안내를 다시 보이게 한다.' }
      ];
    },
    cycle: function (key, dir) {
      if (key === 'move') this.move = (this.move + dir + MOVE_SPEEDS.length) % MOVE_SPEEDS.length;
      else if (key === 'text') this.text = (this.text + dir + TEXT_SPEEDS.length) % TEXT_SPEEDS.length;
      else if (key === 'autoDash') this.autoDash = !this.autoDash;
      else if (key === 'tips') this.tips = !this.tips;
      else if (key === 'resetTips') { this.seenTips = {}; SH.Tips.clear(); }
      this.save();
      SH.Audio.sfx('move');
    }
  };

  /* ==================================================================
     tutorial tips - one short line at a time, each shown once
     ================================================================== */
  var Tips = SH.Tips = {
    queue: [],
    cur: null,
    t: 0,

    /* Fire a tip the first time its situation comes up. */
    show: function (id, text, secs) {
      if (!Settings.tips || Settings.seenTips[id]) return false;
      Settings.seenTips[id] = true;
      Settings.save();
      this.queue.push({ text: text, secs: secs || 4.5 });
      return true;
    },
    /* Always show, even if seen - for the guided opening. */
    force: function (text, secs) {
      this.queue.push({ text: text, secs: secs || 4.5 });
    },
    clear: function () { this.queue.length = 0; this.cur = null; },
    active: function () { return !!this.cur; },

    update: function (dt) {
      if (!this.cur) {
        if (!this.queue.length) return;
        this.cur = this.queue.shift();
        this.t = 0;
        SH.Audio.sfx('tip');
      }
      this.t += dt;
      /* confirm skips ahead once the line has had a moment to be read */
      if (this.t > this.cur.secs || (this.t > 0.6 && SH.Input.pressed('confirm'))) {
        this.cur = null;
      }
    },

    draw: function () {
      if (!this.cur) return;
      var fade = Math.min(1, this.t * 5, (this.cur.secs - this.t) * 5);
      if (fade <= 0) return;
      var rows = SH.wrap(this.cur.text, SH.W - 40, 9);
      var h = 12 + rows.length * 11;
      var y = 22;
      SH.ctx.save();
      SH.ctx.globalAlpha = fade;
      SH.rect(16, y, SH.W - 32, h, '#05050a');
      SH.frameRect(16, y, SH.W - 32, h, '#ffd23f', 1);
      rows.forEach(function (r, i) {
        SH.text(r, SH.W / 2, y + 6 + i * 11,
                { color: '#ffd23f', size: 9, align: 'center' });
      });
      SH.ctx.restore();
    }
  };

  /* A scene that edits the options; `onClose` returns wherever we came from. */
  function OptionsPanel(onClose) {
    this.onClose = onClose || function () {};
    this.i = 0;
  }
  OptionsPanel.prototype.rebuild = function () {
    this.menu = new SH.Menu(Settings.menuItems(),
                            { x: 46, y: 78, lh: 19, size: 11, rightX: 100 });
    this.menu.i = this.i;
  };
  OptionsPanel.prototype.noTips = true;
  OptionsPanel.prototype.enter = function () { this.rebuild(); };
  OptionsPanel.prototype.update = function () {
    if (!this.menu) this.rebuild();
    var picked = this.menu.update();
    this.i = this.menu.i;
    var key = this.menu.items[this.i].value;
    if (SH.Input.pressed('left')) { Settings.cycle(key, -1); this.rebuild(); }
    if (SH.Input.pressed('right') || picked) { Settings.cycle(key, 1); this.rebuild(); }
    if (SH.Input.pressed('cancel') || SH.Input.pressed('menu')) {
      SH.Audio.sfx('cancel');
      this.onClose();
    }
  };
  OptionsPanel.prototype.draw = function () {
    SH.clear('#05050a');
    SH.text('OPTIONS', SH.W / 2, 40, { color: '#ffd23f', size: 14, bold: true, align: 'center' });
    SH.rect(54, 62, SH.W - 108, 1, '#3a3a4c');
    if (this.menu) this.menu.draw();
    SH.text('← → 로 변경 · X 로 돌아가기', SH.W / 2, SH.H - 12,
            { color: '#55556b', size: 9, align: 'center' });
  };
  SH.OptionsPanel = OptionsPanel;

  /* ==================================================================
     global run state
     ================================================================== */
  var Game = SH.Game = {
    lv: 1, exp: 0,
    hp: 46, maxhp: 46, tp: 0, maxtp: 100,
    atk: 11, def: 3,
    rings: 0,
    items: ['ring', 'ring'],
    emeralds: [false, false, false, false, false, false, false],
    stageProgress: {},
    seenIntro: {},
    currentMap: 'westopolis',
    superForm: false,
    lastSave: '',     // which save pillar is lit

    newRun: function () {
      this.lv = 1; this.exp = 0;
      this.maxhp = 46; this.hp = 46;
      this.tp = 0; this.maxtp = 100;
      this.atk = 11; this.def = 3;
      this.rings = 0;
      this.items = ['ring', 'ring'];
      this.emeralds = [false, false, false, false, false, false, false];
      this.stageProgress = {};
      this.seenIntro = {};
      this.currentMap = 'westopolis';
      this.superForm = false;
      this.lastSave = '';
      SH.Story.reset();
    },

    checkLevel: function () {
      var up = false;
      while (this.lv < EXP_TABLE.length && this.exp >= EXP_TABLE[this.lv]) {
        this.lv++;
        this.maxhp += 6;
        this.hp = this.maxhp;
        this.atk += 2;
        if (this.lv % 2 === 0) this.def += 1;
        up = true;
      }
      return up;
    },

    emeraldCount: function () {
      return this.emeralds.filter(Boolean).length;
    },
    /* Chaos Spear / Blast / Control are the emeralds' power, so none of them
       work until he is carrying one. */
    chaosUnlocked: function () {
      return this.emeraldCount() > 0;
    },
    giveEmerald: function () {
      for (var i = 0; i < 7; i++) if (!this.emeralds[i]) { this.emeralds[i] = true; return i; }
      return -1;
    },
    emeraldSpriteFor: function (o) {
      var i = (o && o.emeraldIndex) || 0;
      return EMERALD_SPRITES[(this.emeraldCount() + i) % 7];
    },

    /* ---- persistence -------------------------------------------------- */
    save: function () {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          v: 1,
          run: {
            lv: this.lv, exp: this.exp, hp: this.hp, maxhp: this.maxhp,
            tp: this.tp, atk: this.atk, def: this.def, rings: this.rings,
            items: this.items, emeralds: this.emeralds,
            stageProgress: this.stageProgress, seenIntro: this.seenIntro,
            currentMap: this.currentMap, lastSave: this.lastSave
          },
          story: SH.Story.save()
        }));
        return true;
      } catch (e) { return false; }
    },
    loadSave: function () {
      try {
        var raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    },
    applySave: function (d) {
      if (!d || !d.run) return false;
      var r = d.run;
      this.lv = r.lv; this.exp = r.exp; this.hp = r.hp; this.maxhp = r.maxhp;
      this.tp = r.tp || 0; this.atk = r.atk; this.def = r.def; this.rings = r.rings;
      this.items = r.items || []; this.emeralds = r.emeralds || this.emeralds;
      this.stageProgress = r.stageProgress || {};
      this.seenIntro = r.seenIntro || {};
      this.currentMap = r.currentMap || 'westopolis';
      this.lastSave = r.lastSave || '';
      SH.Story.load(d.story);
      return true;
    },

    /* ---- flow ---------------------------------------------------------- */
    onStageCleared: function (mapId, next, chosen) {
      this.hp = Math.min(this.maxhp, this.hp + 18);
      this.save();
      if (next === 'FINAL') { SH.startFinale(); return; }
      this.currentMap = next;
      SH.enterMap(next);
      SH.fadeIn(0.4);
    },

    gameOver: function () { SH.push(new GameOver()); }
  };

  /* ==================================================================
     shared: a scripted dialogue scene over a still backdrop
     ================================================================== */
  function Cutscene(lines, opt) {
    opt = opt || {};
    this.lines = lines;
    this.opt = opt;
    this.onDone = opt.onDone || function () {};
    this.t = 0;
  }
  Cutscene.prototype.enter = function () {
    if (this.opt.bgm) SH.Audio.play(this.opt.bgm);
    var self = this;
    this.box = new SH.Textbox(this.lines, {
      onDone: function () { self.box = null; self.onDone(); }
    });
  };
  Cutscene.prototype.update = function (dt) {
    this.t += dt;
    if (this.box) this.box.update(dt);
  };
  Cutscene.prototype.draw = function () {
    SH.clear('#05050a');
    var t = this.t;
    for (var i = 0; i < 40; i++) {
      var x = (i * 79 + Math.floor(t * 8)) % SH.W;
      var y = (i * 53) % 150;
      SH.rect(x, y, 1, 1, i % 4 ? '#1c1c30' : '#33334d');
    }
    if (this.opt.actor) {
      SH.drawFoot(this.opt.actor, SH.frameOf(this.opt.actor, 'idle', t * 3),
                  SH.W / 2, 146, { scale: this.opt.scale || 1 });
    }
    if (this.opt.title) {
      SH.text(this.opt.title, SH.W / 2, 24,
              { color: '#d8232f', size: 12, bold: true, align: 'center' });
    }
    if (this.box) this.box.draw();
  };

  SH.playCutscene = function (lines, opt) { SH.push(new Cutscene(lines, opt)); };

  /* ==================================================================
     title screen
     ================================================================== */
  function Title() { this.t = 0; }

  Title.prototype.noTips = true;

  Title.prototype.enter = function () {
    SH.Audio.play('title');
    var saved = Game.loadSave();
    if (saved && saved.story) SH.Story.load(saved.story);
    var items = [
      { label: 'NEW GAME', value: 'new', desc: '새로운 이야기를 시작한다.' },
      { label: 'CONTINUE', value: 'continue', enabled: !!saved,
        desc: saved ? '마지막 저장 지점부터 이어서 한다.' : '저장된 데이터가 없다.' },
      { label: '[ LAST STORY ]', value: 'last',
        color: '#c0ff3c',
        enabled: !!SH.Story.flags.lastStoryUnlocked,
        desc: SH.Story.flags.lastStoryUnlocked
          ? '진정한 결말. 슈퍼 섀도우 대 데빌 둠.'
          : 'ENDING 3 을 카오스 에메랄드 7개와 함께 클리어하면 열린다.' },
      { label: 'ROUTE RECORD', value: 'record', desc: '지금까지의 분기 기록을 본다.' },
      { label: 'OPTIONS', value: 'options', desc: '이동 속도 · 텍스트 속도를 바꾼다.' }
    ];
    this.menu = new SH.Menu(items, { x: 96, y: 132, lh: 16, size: 11 });
    this.savedData = saved;
    SH.fadeIn(0.6);
  };

  Title.prototype.update = function (dt) {
    this.t += dt;
    var picked = this.menu.update();
    if (!picked) return;
    var self = this;
    if (picked.value === 'new') {
      Game.newRun();
      SH.fadeOut(0.5, function () { SH.replace(new Prologue()); SH.fadeIn(0.5); });
    } else if (picked.value === 'continue') {
      if (Game.applySave(this.savedData)) {
        SH.fadeOut(0.5, function () {
          SH.replace(new Overworld_(Game.currentMap));
          SH.fadeIn(0.5);
        });
      }
    } else if (picked.value === 'last') {
      SH.fadeOut(0.6, function () { SH.replace(new LastStory()); SH.fadeIn(0.6); });
    } else if (picked.value === 'options') {
      SH.push(new OptionsPanel(function () { SH.pop(); }));
    } else {
      SH.push(new RecordScreen());
    }
  };

  Title.prototype.draw = function () {
    SH.clear('#05050a');
    var t = this.t;
    /* starfield + comet */
    for (var i = 0; i < 60; i++) {
      var x = (i * 61 + Math.floor(t * 6)) % SH.W;
      var y = (i * 37) % 130;
      SH.rect(x, y, 1, 1, i % 5 ? '#23233a' : '#5c5c86');
    }
    SH.ctx.save();
    SH.ctx.globalAlpha = 0.5;
    SH.drawC('black_doom', SH.frameOf('black_doom', 'idle', t * 1.5), 288, 44, { alpha: 0.28 });
    SH.ctx.restore();
    SH.drawFoot('shadow', SH.frameOf('shadow', 'idle', t * 2.5), 60, 132);

    SH.text('SHADOW', 152, 32, { color: '#d8232f', size: 22, bold: true, shadow: false });
    SH.text('SHADOW', 150, 30, { color: '#f2f2f8', size: 22, bold: true, shadow: false });
    SH.text('THE HEDGEHOG', 150, 58, { color: '#ffd23f', size: 12, bold: true });
    SH.text('16-BIT  ·  UNDERTALE x DELTARUNE', 150, 76,
            { color: '#6e6e88', size: 8 });
    SH.rect(148, 90, 156, 1, '#d8232f');

    this.menu.draw();
    if (Math.sin(t * 3) > -0.3) {
      SH.text('Z 로 결정 · 방향키로 이동', SH.W / 2, SH.H - 12,
              { color: '#55556b', size: 8, align: 'center' });
    }
  };

  /* ==================================================================
     route record screen
     ================================================================== */
  function RecordScreen() {}
  RecordScreen.prototype.noTips = true;
  RecordScreen.prototype.update = function () {
    if (SH.Input.pressed('cancel') || SH.Input.pressed('confirm')) SH.pop();
  };
  RecordScreen.prototype.draw = function () {
    SH.clear('#05050a');
    SH.text('ROUTE RECORD', SH.W / 2, 16, { color: '#ffd23f', size: 13, bold: true, align: 'center' });
    var lines = SH.Story.summary();
    lines.forEach(function (l, i) {
      SH.text(l, 22, 44 + i * 16, { color: '#d8d8e4', size: 10 });
    });
    var e = SH.Story.clearedEndings;
    var eds = [
      ['ENDING 1  인류 학살 루트', 'ending_dark'],
      ['ENDING 2  방관자 루트', 'ending_bystander'],
      ['ENDING 3  외계인 학살 루트', 'ending_hero'],
      ['TRUE END  LAST STORY', 'ending_true']
    ];
    SH.text('ENDINGS', 22, 118, { color: '#7fdcff', size: 10, bold: true });
    eds.forEach(function (p, i) {
      var on = !!e[p[1]];
      SH.text((on ? '★ ' : '☆ ') + p[0], 22, 136 + i * 15,
              { color: on ? '#ffd23f' : '#55556b', size: 10 });
    });
    SH.text('X 로 돌아가기', SH.W / 2, SH.H - 16, { color: '#6e6e88', size: 9, align: 'center' });
  };

  /* ==================================================================
     prologue
     ================================================================== */
  function Prologue() {}
  Prologue.prototype.enter = function () {
    SH.Audio.play('title');
    var self = this;
    this.box = new SH.Textbox([
      { text: '― 50년 전, 스페이스 콜로니 ARK ―' },
      { who: '마리아', face: 'face_maria', color: '#7fd7ff',
        text: '섀도우... 부탁이야. 모두를... 행복하게 해줘.' },
      { text: '그 목소리만이 남았다. 이유도, 방법도 없이.' },
      { text: '― 현재. 검은 혜성이 하늘을 덮었다. ―' },
      { who: '블랙 둠', face: 'face_doom', color: '#c0ff3c',
        text: '섀도우여. 일곱 개의 카오스 에메랄드를 가져와라.\n그러면 네 과거를 전부 돌려주마.' },
      { who: '섀도우', face: 'face_shadow', frame: 1,
        text: '...좋다. 하지만 무엇을 벨지는 내가 정한다.' }
    ], {
      onDone: function () {
        SH.fadeOut(0.5, function () {
          SH.replace(new Overworld_('westopolis'));
          SH.fadeIn(0.5);
        });
      }
    });
  };
  Prologue.prototype.update = function (dt) { if (this.box) this.box.update(dt); };
  Prologue.prototype.draw = function () {
    SH.clear('#05050a');
    for (var i = 0; i < 50; i++) {
      var x = (i * 67 + Math.floor(SH.time * 5)) % SH.W;
      SH.rect(x, (i * 43) % 150, 1, 1, i % 4 ? '#1c1c30' : '#3d3d63');
    }
    SH.drawFoot('shadow', SH.frameOf('shadow', 'idle', SH.time * 2), SH.W / 2, 150);
    if (this.box) this.box.draw();
  };

  /* thin wrapper so Title can construct an Overworld before it is defined */
  function Overworld_(id) { return new SH.Overworld(id); }

  /* ==================================================================
     pause menu (drawn over the overworld)
     ================================================================== */
  SH.makePauseMenu = function (owner) {
    var tab = 0;
    var TABS = ['STATUS', 'ITEM', 'ROUTE', 'SETTING', 'SYSTEM'];
    var itemMenu = null, sysMenu = null, note = '';
    var optIdx = 0;

    function optionMenu() {
      var m = new SH.Menu(Settings.menuItems(),
                          { x: 30, y: 48, lh: 17, size: 10, rightX: 104, descY: 178 });
      m.i = optIdx;
      return m;
    }

    function rebuild() {
      itemMenu = new SH.Menu(Game.items.map(function (k, i) {
        var it = SH.Items[k];
        return { label: it.name, value: i, desc: it.heal ? ('HP +' + it.heal) : ('TP +' + it.tp) };
      }), { x: 40, y: 74, lh: 15, size: 11 });
      sysMenu = new SH.Menu([
        { label: '저장하기', value: 'save', desc: '현재 진행 상황을 저장한다.' },
        { label: '타이틀로', value: 'title', desc: '저장하지 않은 진행은 사라진다.' },
        { label: '돌아가기', value: 'back', desc: '' }
      ], { x: 40, y: 74, lh: 16, size: 11 });
    }
    rebuild();

    return {
      drawUnder: true,
      noTips: true,
      update: function () {
        if (SH.Input.pressed('menu')) { SH.pop(); return; }
        /* The SETTING tab consumes left/right for its own values, so tabs are
           only switched from the other tabs - and a press that switches the
           tab must not also be read by the tab it lands on. */
        if (tab !== 3) {
          var was = tab;
          if (SH.Input.pressed('left')) { tab = (tab + TABS.length - 1) % TABS.length; SH.Audio.sfx('move'); }
          if (SH.Input.pressed('right')) { tab = (tab + 1) % TABS.length; SH.Audio.sfx('move'); }
          if (tab !== was) return;
        }

        if (tab === 1) {
          var p = itemMenu.update();
          if (p) {
            var key = Game.items[p.value], it = SH.Items[key];
            Game.items.splice(p.value, 1);
            if (it.heal) Game.hp = Math.min(Game.maxhp, Game.hp + it.heal);
            if (it.tp) Game.tp = Math.min(Game.maxtp, Game.tp + it.tp);
            SH.Audio.sfx('heal');
            note = it.text;
            rebuild();
          }
        } else if (tab === 3) {
          var om = optionMenu();
          var op = om.update();
          optIdx = om.i;
          var key = om.items[optIdx].value;
          if (SH.Input.pressed('left')) Settings.cycle(key, -1);
          else if (SH.Input.pressed('right') || op) Settings.cycle(key, 1);
          else if (SH.Input.pressed('cancel')) { tab = 2; SH.Audio.sfx('cancel'); }
        } else if (tab === 4) {
          var s = sysMenu.update();
          if (s) {
            if (s.value === 'save') { note = Game.save() ? '저장했다.' : '저장에 실패했다.'; }
            else if (s.value === 'title') {
              SH.fadeOut(0.4, function () { SH.replace(new Title()); SH.fadeIn(0.4); });
            } else SH.pop();
          }
        } else if (SH.Input.pressed('cancel')) SH.pop();
      },
      draw: function () {
        SH.ctx.save();
        SH.ctx.globalAlpha = 0.85;
        SH.rect(0, 0, SH.W, SH.H, '#05050a');
        SH.ctx.restore();
        SH.frameRect(8, 8, SH.W - 16, SH.H - 16, '#f2f2f8', 2);
        TABS.forEach(function (t, i) {
          var x = 18 + i * 58;
          SH.text(t, x, 18, { color: i === tab ? '#ffd23f' : '#55556b', size: 10, bold: i === tab });
        });
        SH.rect(16, 32, SH.W - 32, 1, '#3a3a4c');

        if (tab === 0) {
          SH.drawFoot('shadow', SH.frameOf('shadow', 'idle', SH.time * 2), 56, 150);
          var rows = [
            'SHADOW THE HEDGEHOG',
            'LV  ' + Game.lv + '   EXP ' + Game.exp,
            'HP  ' + Math.ceil(Game.hp) + ' / ' + Game.maxhp,
            'TP  ' + Math.floor(Game.tp) + ' / ' + Game.maxtp,
            'AT  ' + Game.atk + '   DF ' + Game.def,
            'RING ' + Game.rings,
            'EMERALD ' + Game.emeraldCount() + ' / 7'
          ];
          rows.forEach(function (r, i) {
            SH.text(r, 110, 46 + i * 15, { color: i === 0 ? '#ffd23f' : '#d8d8e4', size: 10 });
          });
        } else if (tab === 1) {
          if (!Game.items.length) SH.text('아이템이 없다.', 40, 74, { color: '#6e6e88', size: 10 });
          else itemMenu.draw();
        } else if (tab === 3) {
          optionMenu().draw();
          SH.text('← → 로 값 변경 · X 로 다른 탭으로', 30, 144,
                  { color: '#6e6e88', size: 9 });
        } else if (tab === 2) {
          SH.Story.summary().forEach(function (l, i) {
            SH.text(l, 26, 48 + i * 17, { color: '#d8d8e4', size: 10 });
          });
          SH.text('처치는 어둠으로, 자비는 빛으로 기록된다.', 26, 132,
                  { color: '#6e6e88', size: 9 });
          SH.text('현재 예상 엔딩: ' + SH.Story.endingTitle(SH.Story.evaluateEnding()), 26, 150,
                  { color: '#ffd23f', size: 10 });
        } else {
          sysMenu.draw();
        }
        if (note) SH.text(note, SH.W / 2, SH.H - 38, { color: '#7dff9b', size: 9, align: 'center' });
        SH.text('C 로 닫기 · ← → 탭 전환', SH.W / 2, SH.H - 24,
                { color: '#55556b', size: 8, align: 'center' });
      }
    };
  };

  /* ==================================================================
     game over
     ================================================================== */
  function GameOver() { this.t = 0; }
  GameOver.prototype.noTips = true;

  GameOver.prototype.enter = function () {
    SH.Audio.stop();
    this.menu = new SH.Menu([
      { label: 'CONTINUE', value: 'continue', desc: '마지막 저장 지점에서 다시 시작한다.' },
      { label: 'TITLE', value: 'title', desc: '타이틀 화면으로 돌아간다.' }
    ], { x: 118, y: 152, lh: 17, size: 11 });
  };
  GameOver.prototype.update = function (dt) {
    this.t += dt;
    var p = this.menu.update();
    if (!p) return;
    if (p.value === 'continue') {
      var d = Game.loadSave();
      if (d && Game.applySave(d)) {
        Game.hp = Game.maxhp;
        SH.fadeOut(0.4, function () {
          SH.replace(new SH.Overworld(Game.currentMap));
          SH.fadeIn(0.4);
        });
      } else {
        Game.newRun();
        SH.fadeOut(0.4, function () { SH.replace(new Title()); SH.fadeIn(0.4); });
      }
    } else {
      SH.fadeOut(0.4, function () { SH.replace(new Title()); SH.fadeIn(0.4); });
    }
  };
  GameOver.prototype.draw = function () {
    SH.clear('#05050a');
    SH.text('GAME OVER', SH.W / 2, 60, { color: '#d8232f', size: 22, bold: true, align: 'center' });
    SH.text('"이 정도로 끝날 생명체가 아니다."', SH.W / 2, 96,
            { color: '#9b9bb4', size: 10, align: 'center' });
    SH.drawFoot('shadow', SH.frameOf('shadow', 'hurt', 0), SH.W / 2, 144);
    this.menu.draw();
  };

  /* ==================================================================
     finale + endings
     ================================================================== */
  SH.startFinale = function () {
    var route = SH.Story.isPurePacifist() ? 'normal' : SH.Story.dominantRoute();
    var boss = SH.Story.finalBossFor(route);

    if (!boss) {                                  /* 방관자 루트 */
      SH.playCutscene([
        { who: '블랙 둠', face: 'face_doom', color: '#c0ff3c',
          text: '아무도 베지 않았군. 그것도 하나의 선택이다.' },
        { who: '섀도우', face: 'face_shadow',
          text: '...나는 어느 쪽도 아니다.' },
        { text: '섀도우는 검은 혜성의 문턱에서 걸음을 멈췄다.' }
      ], { bgm: 'comet', onDone: function () { SH.showEnding('ending_bystander'); } });
      return;
    }

    var ids = boss === 'sonic' ? ['sonic', 'tails'] : ['black_doom'];
    var intro = boss === 'sonic' ? [
      { who: '소닉', face: 'face_sonic', color: '#7fd7ff',
        text: '여기까지야, 섀도우. 이 앞은 못 지나가.' },
      { who: '섀도우', face: 'face_shadow', frame: 1,
        text: '그럼 밟고 지나가겠다.' }
    ] : [
      { who: '블랙 둠', face: 'face_doom', color: '#c0ff3c',
        text: '나를 거스르겠다는 거냐. 네 안의 피까지 거스를 셈인가!' },
      { who: '섀도우', face: 'face_shadow', frame: 1,
        text: '피는 내 것이다. 네 것이 아니라.' }
    ];

    SH.playCutscene(intro, {
      bgm: 'boss',
      onDone: function () {
        SH.pop();                                   /* close the cutscene */
        SH.startBattle(ids, {
          boss: true, bgm: 'boss',
          onEnd: function (res) {
            if (res.outcome === 'lose') { Game.gameOver(); return; }
            if (res.outcome === 'win') {
              SH.showEnding(boss === 'sonic' ? 'ending_dark' : 'ending_hero');
            } else {
              /* spared or fled at the last moment - nobody was stopped */
              SH.showEnding('ending_bystander');
            }
          }
        });
      }
    });
  };

  /* ---- Last Story: Super Shadow vs Devil Doom ------------------------- */
  function LastStory() {}
  LastStory.prototype.enter = function () {
    Game.superForm = true;
    Game.maxhp = 99; Game.hp = 99;
    Game.atk = 24; Game.def = 8; Game.tp = 100;
    Game.items = ['ring', 'ring', 'chaos_drive'];
    var self = this;
    SH.playCutscene([
      { text: '일곱 개의 카오스 에메랄드가 그의 주위를 돈다.' },
      { who: '섀도우', face: 'face_shadow',
        text: '...전부 기억났다. 나는 무엇으로 만들어졌는지도.' },
      { who: '블랙 둠', face: 'face_doom', color: '#c0ff3c',
        text: '그렇다면 돌아와라! 너는 나의 그림자다!' },
      { who: '섀도우', face: 'face_super',
        text: '아니. 나는 섀도우 더 헤지혹이다.' },
      { text: '카오스 에메랄드의 빛이 그를 감쌌다. ― 슈퍼 섀도우.' }
    ], {
      bgm: 'last', title: 'LAST STORY', actor: 'shadow_super',
      onDone: function () {
        SH.pop();
        SH.startBattle(['devil_doom'], {
          boss: true, bgm: 'last', superForm: true,
          onEnd: function (res) {
            Game.superForm = false;
            if (res.outcome === 'lose') { Game.gameOver(); return; }
            SH.showEnding('ending_true');
          }
        });
      }
    });
  };
  LastStory.prototype.update = function () {};
  LastStory.prototype.draw = function () { SH.clear('#05050a'); };

  /* ---- ending playback ------------------------------------------------ */
  function Ending(key) { this.key = key; this.t = 0; this.phase = 0; }
  Ending.prototype.enter = function () {
    SH.Audio.play(SH.Story.endingBgm(this.key));
    SH.Story.markEndingCleared(this.key, Game.emeraldCount());
    Game.save();
    var self = this;
    this.box = new SH.Textbox(SH.Story.script(this.key), {
      onDone: function () { self.phase = 1; self.t = 0; }
    });
  };
  Ending.prototype.update = function (dt) {
    this.t += dt;
    if (this.phase === 0) { if (this.box) this.box.update(dt); return; }
    if (this.t > 1.2 && (SH.Input.pressed('confirm') || SH.Input.pressed('cancel'))) {
      SH.fadeOut(0.8, function () { SH.replace(new Title()); SH.fadeIn(0.8); });
    }
  };
  Ending.prototype.draw = function () {
    SH.clear('#05050a');
    var t = SH.time;
    for (var i = 0; i < 50; i++) {
      var x = (i * 71 + Math.floor(t * 4)) % SH.W;
      SH.rect(x, (i * 47) % 160, 1, 1, i % 4 ? '#1c1c30' : '#3d3d63');
    }
    var sheet = this.key === 'ending_true' ? 'shadow_super' : 'shadow';
    SH.drawFoot(sheet, SH.frameOf(sheet, 'idle', t * 2), SH.W / 2, 148);

    if (this.phase === 0) {
      if (this.box) this.box.draw();
    } else {
      SH.rect(0, 84, SH.W, 60, '#05050a');
      SH.text(SH.Story.endingTitle(this.key), SH.W / 2, 96,
              { color: '#ffd23f', size: 13, bold: true, align: 'center' });
      if (this.key === 'ending_hero' && SH.Story.flags.lastStoryUnlocked) {
        SH.text('[ LAST STORY ] 가 해금되었다.', SH.W / 2, 118,
                { color: '#c0ff3c', size: 10, align: 'center' });
      } else if (this.key === 'ending_hero') {
        SH.text('에메랄드 7개를 모아 순수 히어로 루트로 클리어하면 LAST STORY 가 열린다.',
                SH.W / 2, 118, { color: '#6e6e88', size: 8, align: 'center' });
      }
      if (Math.sin(t * 4) > 0) {
        SH.text('Z 로 타이틀로', SH.W / 2, SH.H - 18,
                { color: '#9b9bb4', size: 9, align: 'center' });
      }
    }
  };

  SH.showEnding = function (key) {
    SH.fadeOut(0.6, function () { SH.replace(new Ending(key)); SH.fadeIn(0.6); });
  };

  /* ==================================================================
     boot
     ================================================================== */
  function start() {
    Settings.load();
    var el = document.getElementById('bootmsg');
    SH.Assets.load(function (done, total) {
      if (el) el.textContent = '스프라이트 로드 중... ' + done + ' / ' + total;
    }).then(function () {
      var boot = document.getElementById('boot');
      if (boot) boot.classList.add('gone');
      SH.boot(new Title());
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 0);
  } else {
    window.addEventListener('DOMContentLoaded', start);
  }

  SH.Title = Title;
})(window.SH = window.SH || {});
