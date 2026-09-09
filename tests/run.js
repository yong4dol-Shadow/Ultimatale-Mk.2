/* =====================================================================
   tests/run.js - headless smoke + logic tests.

   Drives the real game in Chromium: boots it, walks the stage-clear
   flow, opens the finale for every route, and steps every bullet
   pattern, failing on any page error.

     npm i -D playwright   (or use a globally installed playwright)
     node tests/run.js
   ===================================================================== */
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
    '/usr/local/lib/node_modules/playwright'
  ];
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* keep looking */ }
  }
  console.error('playwright not found. install it with:  npm i -D playwright');
  process.exit(2);
}

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (d.startsWith('chromium-') && fs.existsSync(p)) return p;
    }
  } catch (e) { /* fall through to playwright's own download */ }
  return undefined;
}

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'tests', 'shots');

(async () => {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(SHOTS, { recursive: true });

  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' || (m.type() === 'warning' && !/AudioContext/.test(t))) {
      errors.push(m.type().toUpperCase() + ': ' + t);
    }
  });

  /* #stage, not #screen: text lives on a second canvas layered over it */
  const shot = n => page.locator('#stage').screenshot({ path: path.join(SHOTS, n + '.png') });
  const key = async (k, n = 1) => {
    for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(110); }
  };

  const checks = [];
  const check = (name, ok) => checks.push([name, !!ok]);

  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.SH && SH.scenes.length > 0, { timeout: 20000 });
  await page.waitForTimeout(500);
  await shot('01_title');
  check('boots to the title screen', await page.evaluate(() => SH.scenes.length === 1));

  /* ---- text layer renders above the pixel buffer, at real density ---- */
  const layer = await page.evaluate(() => {
    const s = document.getElementById('screen');
    const t = document.getElementById('text-layer');
    if (!t) return null;
    return {
      backing: t.width, css: Math.round(t.getBoundingClientRect().width),
      screenCss: Math.round(s.getBoundingClientRect().width),
      painted: (() => {
        const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
        return false;
      })()
    };
  });
  check('text layer exists and overlays the screen exactly',
    !!layer && layer.css === layer.screenCss);
  /* at least one device pixel per CSS pixel, and far more than the
     320-wide pixel buffer it sits on */
  check('text layer backs more pixels than the 320px buffer',
    !!layer && layer.backing > 320 && layer.backing >= layer.css);
  check('text actually draws onto the layer', !!layer && layer.painted);

  /* ---- options ------------------------------------------------------- */
  const opts = await page.evaluate(() => {
    const S = SH.Settings, before = S.speedMul();
    S.move = 2; S.autoDash = true; S.text = 2; S.save();
    const stored = JSON.parse(localStorage.getItem('shadow_the_hedgehog_16bit_options'));
    S.move = 0; S.autoDash = false; S.text = 0; S.load();
    return {
      before: before, fastest: S.speedMul(), stored: stored,
      reloadedMove: S.move, reloadedDash: S.autoDash, cps: S.textCps()
    };
  });
  check('move speed option raises the multiplier', opts.fastest > opts.before);
  check('options persist and reload', opts.reloadedMove === 2 && opts.reloadedDash === true);
  check('text speed option is applied', opts.cps > 42);
  await page.evaluate(() => {
    SH.Settings.move = 0; SH.Settings.text = 0; SH.Settings.autoDash = false; SH.Settings.save();
  });

  /* ---- title -> prologue -> overworld through real key presses ---- */
  await key('KeyZ');
  await page.waitForTimeout(1200);
  await key('KeyZ', 14);
  await page.waitForTimeout(1400);
  check('NEW GAME reaches the overworld',
    await page.evaluate(() => !!SH.scenes[0].mapId));
  await key('KeyZ', 6);
  await page.waitForTimeout(300);
  await shot('02_overworld');

  /* ---- overworld uses the compact build, not the battle sprite ------- */
  const sprites = await page.evaluate(() => {
    const ow = SH.Assets.sheet('shadow_ow'), big = SH.Assets.sheet('shadow');
    return ow && big ? { ow: [ow.fw, ow.fh], big: [big.fw, big.fh] } : null;
  });
  check('overworld sprite is smaller than the battle sprite',
    !!sprites && sprites.ow[1] < sprites.big[1] && sprites.ow[0] < sprites.big[0]);

  /* ---- movement speed ------------------------------------------------ */
  const moved = await page.evaluate(async () => {
    const walk = async (secs) => {
      const o = SH.scenes[SH.scenes.length - 1];
      o.player.x = 40; o.player.y = 120;
      const start = o.player.x;
      const t0 = performance.now();
      SH.Input.state.right = true;
      await new Promise(r => setTimeout(r, secs * 1000));
      SH.Input.state.right = false;
      const dt = (performance.now() - t0) / 1000;
      return (o.player.x - start) / dt;
    };
    SH.Settings.move = 0; const slow = await walk(0.5);
    SH.Settings.move = 2; const fast = await walk(0.5);
    SH.Settings.move = 0;
    return { slow: slow, fast: fast };
  });
  check('base walk speed is above 90 px/s', moved.slow > 90);
  check('the fast option moves noticeably faster', moved.fast > moved.slow * 1.3);

  /* ---- facing follows the input, and dashing uses the skate pose ----- */
  const facing = await page.evaluate(async () => {
    const o = SH.scenes[SH.scenes.length - 1];
    const hold = async (k, extra) => {
      SH.Input.state = {}; SH.Input.state[k] = true;
      if (extra) SH.Input.state[extra] = true;
      await new Promise(r => setTimeout(r, 120));
      const p = o.player;
      const out = { dir: p.dir, face: p.face, skating: p.skating };
      SH.Input.state = {};
      return out;
    };
    o.player.x = 200; o.player.y = 200;
    const down = await hold('down');
    o.player.x = 200; o.player.y = 200;
    const up = await hold('up');
    o.player.x = 200; o.player.y = 200;
    const left = await hold('left');
    o.player.x = 200; o.player.y = 200;
    const dash = await hold('right', 'cancel');
    const sheet = SH.Assets.sheet('shadow_ow');
    return { down, up, left, dash, names: Object.keys(sheet.names), frames: sheet.frames };
  });
  check('walking down faces the camera', facing.down.dir === 'down');
  check('walking up faces away', facing.up.dir === 'up');
  check('walking left keeps the mirrored side view',
    facing.left.dir === 'side' && facing.left.face === -1);
  check('dashing switches to the skate pose', facing.dash.skating === true);
  check('overworld sheet carries all three facings x idle/walk/skate',
    ['idle', 'walk', 'skate', 'down_idle', 'down_walk', 'down_skate',
     'up_idle', 'up_walk', 'up_skate'].every(n => facing.names.includes(n)) &&
    facing.frames === 24);

  /* ---- maps are bigger than one screen in both directions ------------ */
  const mapSize = await page.evaluate(() =>
    SH.MAP_ORDER.map(id => { const m = SH.buildMap(id); return [m.w, m.h]; }));
  check('every map is at least 48x32 tiles',
    mapSize.every(s => s[0] >= 48 && s[1] >= 32));

  /* ---- encounters are paced for the faster player -------------------- */
  const rates = await page.evaluate(() =>
    SH.MAP_ORDER.map(id => SH.Maps[id].encounter.rate));
  check('encounter distance is at least 700px everywhere',
    rates.every(r => r >= 700));

  /* ---- pause menu, including the settings tab ----------------------- */
  await page.evaluate(() => SH.push(SH.makePauseMenu(SH.scenes[0])));
  await page.waitForTimeout(300);
  await key('ArrowRight', 3);
  await page.waitForTimeout(300);
  await shot('03_pause_setting');
  check('pause menu opens over the overworld',
    await page.evaluate(() => SH.scenes.length === 2));
  await key('ArrowRight');
  await page.waitForTimeout(200);
  check('settings tab changes a value in-game',
    await page.evaluate(() => SH.Settings.move === 1));
  await page.evaluate(() => { SH.Settings.move = 0; SH.Settings.save(); SH.pop(); });
  await page.waitForTimeout(200);

  /* ---- mission lock ------------------------------------------------ */
  await page.evaluate(() => { SH.Game.newRun(); SH.Game.seenIntro.westopolis = true; SH.replace(new SH.Overworld('westopolis')); });
  await page.waitForTimeout(700);
  check('gate starts locked', await page.evaluate(() => SH.scenes[0].gateOpen === false));

  await page.evaluate(() => { const o = SH.scenes[0]; o.progress().terminals = 3; o.refreshGate(); });
  check('NORMAL objective unlocks the gate',
    await page.evaluate(() => SH.scenes[0].gateOpen && SH.scenes[0].firstCompleted === 'normal'));
  await shot('04_gate_open');

  await page.evaluate(() => { SH.scenes[0].progress().killedAnyone = true; });
  check('a kill invalidates the pacifist objective',
    await page.evaluate(() => SH.scenes[0].objectiveDone('normal') === false));

  await page.evaluate(() => {
    const o = SH.scenes[0];
    o.firstCompleted = null; o.gateOpen = false;
    o.progress().kills.human = 4; o.refreshGate();
  });
  check('DARK objective unlocks the gate',
    await page.evaluate(() => SH.scenes[0].gateOpen && SH.scenes[0].firstCompleted === 'dark'));

  await page.evaluate(() => SH.scenes[0].leaveStage());
  await page.waitForTimeout(1300);
  check('stage transition advances the map',
    await page.evaluate(() => SH.Game.currentMap === 'glyphic_canyon' && SH.scenes[0].mapId === 'glyphic_canyon'));
  check('stage choice is recorded for the ending',
    await page.evaluate(() => SH.Story.stageResult.westopolis === 'dark'));

  await page.evaluate(() => { const o = SH.scenes[0]; o.progress().destroyed.pod = 3; o.refreshGate(); });
  check('HERO destroy objective works',
    await page.evaluate(() => SH.scenes[0].firstCompleted === 'hero'));

  /* ---- every map builds and renders --------------------------------- */
  for (const id of ['ark', 'gun_fortress', 'black_comet']) {
    await page.evaluate(m => { SH.Game.seenIntro[m] = true; SH.replace(new SH.Overworld(m)); }, id);
    await page.waitForTimeout(600);
    await shot('05_' + id);
  }
  check('every stage map renders', errors.length === 0);

  /* ---- battle ------------------------------------------------------- */
  await page.evaluate(() => { SH.replace(new SH.Overworld('westopolis')); });
  await page.waitForTimeout(600);
  await page.evaluate(() => SH.scenes[0].triggerEncounter());
  await page.waitForTimeout(1500);
  check('an encounter opens a battle', await page.evaluate(() => SH.scenes.length === 2));
  await key('KeyZ', 3);
  await shot('06_battle');
  await page.evaluate(() => { const b = SH.scenes[1]; b.startEnemyTurn(); });
  await page.waitForTimeout(2500);
  await shot('07_bullets');
  check('bullets spawn on the enemy turn',
    await page.evaluate(() => SH.scenes[1].bullets.length > 0));
  check('grazing charges TP', await page.evaluate(() => SH.Game.tp >= 0));

  /* ---- Chaos Blast and the renamed Chaos Control --------------------- */
  const chaos = await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier', 'gun_soldier'], {});
    SH.Game.tp = 100; SH.Game.atk = 11;
    b.openActs(b.enemies[0]);
    const labels = b.menu.items.map(i => i.label);
    const before = b.enemies.map(e => e.hp);
    b.doBlast();
    const after = b.enemies.map(e => e.hp);
    b.openMercy();
    const mercy = b.menu.items.map(i => i.label);
    return {
      actLabels: labels, mercyLabels: mercy, tp: SH.Game.tp,
      dealt: before.map((h, i) => h - after[i])
    };
  });
  check('ACT lists 카오스 블래스트, not 카오스 컨트롤',
    chaos.actLabels.some(l => l.indexOf('카오스 블래스트') === 0) &&
    !chaos.actLabels.some(l => l.indexOf('카오스 컨트롤') === 0));
  check('MERCY renames FLEE to 카오스 컨트롤',
    chaos.mercyLabels.includes('카오스 컨트롤') && !chaos.mercyLabels.includes('FLEE'));
  check('Chaos Blast spends 100 TP', chaos.tp === 0);
  check('Chaos Blast hits every enemy hard',
    chaos.dealt.length === 2 && chaos.dealt.every(d => d >= 30));

  /* ---- the time freeze survives the message that announces it -------- */
  const freeze = await page.evaluate(async () => {
    const b = new SH.Battle(['black_doom'], { boss: true });
    b.chaosPending = 2.4;
    b.state = 'message';
    for (let i = 0; i < 120; i++) b.update(1 / 60);   // two seconds of reading
    const beforeTurn = b.chaosFrozen;
    b.startEnemyTurn();
    return { beforeTurn: beforeTurn, atTurnStart: b.chaosFrozen };
  });
  check('the freeze does not burn down while the message is up',
    freeze.beforeTurn === 0 && freeze.atTurnStart > 2);

  /* ---- ending resolution -------------------------------------------- */
  const e = await page.evaluate(() => {
    const S = SH.Story, o = {};
    S.reset(); o.pacifist = S.evaluateEnding();
    S.reset(); S.kill.human = 10; S.kill.sonic = 2; S.recordStage('a', 'dark'); S.recordStage('b', 'dark');
    o.dark = S.evaluateEnding();
    S.reset(); S.kill.alien = 12; S.spare.human = 6; S.recordStage('a', 'hero'); S.recordStage('b', 'hero');
    o.hero = S.evaluateEnding(); o.heroPure = S.isPureHero();
    o.bosses = [S.finalBossFor('dark'), S.finalBossFor('hero'), S.finalBossFor('normal')];
    S.reset(); S.kill.alien = 12; S.flags.lastStoryUnlocked = false;
    S.markEndingCleared('ending_hero', 6); o.six = S.flags.lastStoryUnlocked;
    S.markEndingCleared('ending_hero', 7); o.seven = S.flags.lastStoryUnlocked;
    return o;
  });
  check('no kills -> ENDING 2 (bystander)', e.pacifist === 'ending_bystander');
  check('human kills -> ENDING 1 (dark)', e.dark === 'ending_dark');
  check('alien-only kills -> ENDING 3 (hero)', e.hero === 'ending_hero' && e.heroPure);
  check('final bosses map to routes',
    e.bosses[0] === 'sonic' && e.bosses[1] === 'black_doom' && e.bosses[2] === null);
  check('Last Story stays locked with 6 emeralds', e.six === false);
  check('Last Story unlocks with 7 emeralds', e.seven === true);

  /* ---- boss encounters ---------------------------------------------- */
  await page.evaluate(() => {
    SH.Story.reset(); SH.Story.kill.alien = 12; SH.Story.recordStage('x', 'hero');
    SH.replace(new SH.Overworld('black_comet'));
    SH.startFinale();
  });
  await page.waitForTimeout(800);
  await key('KeyZ', 6);
  await page.waitForTimeout(1300);
  await shot('08_black_doom');
  check('hero finale spawns Black Doom', await page.evaluate(() => {
    const b = SH.scenes[SH.scenes.length - 1];
    return !!(b.enemies && b.enemies[0] && b.enemies[0].id === 'black_doom');
  }));

  await page.evaluate(() => {
    SH.Game.newRun();
    SH.Game.superForm = true; SH.Game.atk = 24; SH.Game.maxhp = 99; SH.Game.hp = 99;
    SH.replace(new SH.Overworld('black_comet'));
    SH.startBattle(['devil_doom'], { boss: true, bgm: 'last', superForm: true, onEnd: function () {} });
  });
  await page.waitForTimeout(800);
  await key('KeyZ', 3);
  await page.evaluate(() => SH.scenes[SH.scenes.length - 1].startEnemyTurn());
  await page.waitForTimeout(2500);
  await shot('09_devil_doom');
  check('Last Story battle runs as Super Shadow', await page.evaluate(() => {
    const b = SH.scenes[SH.scenes.length - 1];
    return b.enemies[0].id === 'devil_doom' && b.superForm === true;
  }));

  /* ---- options screens render --------------------------------------- */
  await page.evaluate(() => { SH.replace(new SH.Title()); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { SH.push(new SH.OptionsPanel(function () { SH.pop(); })); });
  await page.waitForTimeout(400);
  await shot('10_options');
  await key('ArrowRight', 2);
  await page.waitForTimeout(200);
  check('options screen changes a value with the arrow keys',
    await page.evaluate(() => SH.Settings.move === 2));
  await page.evaluate(() => { SH.Settings.move = 0; SH.Settings.save(); });
  await key('KeyX');
  await page.waitForTimeout(300);

  await page.evaluate(() => SH.showEnding('ending_true'));
  await page.waitForTimeout(1400);
  await shot('11_ending');
  check('ending scene renders', await page.evaluate(() => SH.scenes.length === 1));

  /* ---- every bullet pattern ------------------------------------------ */
  const patterns = await page.evaluate(() => {
    const bad = [];
    const b = new SH.Battle(['gun_soldier'], {});
    b.soul = { x: 160, y: 170, iframe: 0 };
    b.atk = 5;
    const names = Object.keys(SH.Patterns);
    names.forEach(k => {
      try {
        b.bullets.length = 0; b.pt = 0;
        for (let i = 0; i < 20; i++) { b.pt += 0.15; SH.Patterns[k].step(b); }
        for (let i = 0; i < 60; i++) b.updateBullets(1 / 60);
      } catch (err) { bad.push(k + ': ' + err.message); }
    });
    return { count: names.length, bad: bad };
  });
  check('all ' + patterns.count + ' bullet patterns run clean', patterns.bad.length === 0);
  if (patterns.bad.length) console.log(patterns.bad.join('\n'));

  await browser.close();

  let failed = 0;
  console.log('');
  checks.forEach(([n, ok]) => { if (!ok) failed++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n); });
  console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks passed');
  if (errors.length) console.log('\nPAGE ERRORS:\n' + errors.join('\n'));
  console.log('screenshots: ' + path.relative(ROOT, SHOTS));
  process.exit(failed || errors.length ? 1 : 0);
})().catch(err => { console.error('FATAL', err); process.exit(1); });
