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

  const shot = n => page.locator('#screen').screenshot({ path: path.join(SHOTS, n + '.png') });
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

  /* ---- mission lock ------------------------------------------------ */
  await page.evaluate(() => { SH.Game.newRun(); SH.Game.seenIntro.westopolis = true; SH.replace(new SH.Overworld('westopolis')); });
  await page.waitForTimeout(700);
  check('gate starts locked', await page.evaluate(() => SH.scenes[0].gateOpen === false));

  await page.evaluate(() => { const o = SH.scenes[0]; o.progress().terminals = 3; o.refreshGate(); });
  check('NORMAL objective unlocks the gate',
    await page.evaluate(() => SH.scenes[0].gateOpen && SH.scenes[0].firstCompleted === 'normal'));
  await shot('03_gate_open');

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
    await shot('04_' + id);
  }
  check('every stage map renders', errors.length === 0);

  /* ---- battle ------------------------------------------------------- */
  await page.evaluate(() => { SH.replace(new SH.Overworld('westopolis')); });
  await page.waitForTimeout(600);
  await page.evaluate(() => SH.scenes[0].triggerEncounter());
  await page.waitForTimeout(1500);
  check('an encounter opens a battle', await page.evaluate(() => SH.scenes.length === 2));
  await key('KeyZ', 3);
  await shot('05_battle');
  await page.evaluate(() => { const b = SH.scenes[1]; b.startEnemyTurn(); });
  await page.waitForTimeout(2500);
  await shot('06_bullets');
  check('bullets spawn on the enemy turn',
    await page.evaluate(() => SH.scenes[1].bullets.length > 0));
  check('grazing charges TP', await page.evaluate(() => SH.Game.tp >= 0));

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
  await shot('07_black_doom');
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
  await shot('08_devil_doom');
  check('Last Story battle runs as Super Shadow', await page.evaluate(() => {
    const b = SH.scenes[SH.scenes.length - 1];
    return b.enemies[0].id === 'devil_doom' && b.superForm === true;
  }));

  await page.evaluate(() => SH.showEnding('ending_true'));
  await page.waitForTimeout(1400);
  await shot('09_ending');
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
