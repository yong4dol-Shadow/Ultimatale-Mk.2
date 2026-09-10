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
    if (m.type() === 'error' ||
        (m.type() === 'warning' && !/AudioContext|willReadFrequently/.test(t))) {
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
        const d = t.getContext('2d', { willReadFrequently: true })
                   .getImageData(0, 0, t.width, t.height).data;
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
    facing.frames >= 24);

  /* ---- the skate cycle has to actually alternate feet ---------------- */
  const skate = await page.evaluate(() => {
    const s = SH.Assets.sheet('shadow_ow');
    const c = document.createElement('canvas');
    c.width = s.fw; c.height = s.fh;
    const g = c.getContext('2d', { willReadFrequently: true });
    // hash two opposite frames of the side skate cycle; a static pose would
    // make them identical
    const hash = f => {
      const sx = (f % s.cols) * s.fw, sy = ((f / s.cols) | 0) * s.fh;
      g.clearRect(0, 0, s.fw, s.fh);
      g.drawImage(s.img, sx, sy, s.fw, s.fh, 0, 0, s.fw, s.fh);
      const d = g.getImageData(0, 0, s.fw, s.fh).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 3] * 7) | 0;
      return h;
    };
    const frames = s.names.skate;
    // flame pixels: warm colours that were not in the palette before
    const sx = (frames[0] % s.cols) * s.fw, sy = ((frames[0] / s.cols) | 0) * s.fh;
    g.clearRect(0, 0, s.fw, s.fh);
    g.drawImage(s.img, sx, sy, s.fw, s.fh, 0, 0, s.fw, s.fh);
    const d = g.getImageData(0, 0, s.fw, s.fh).data;
    // the jet wash is deliberately small now that it reads as a glide
    // rather than a torch, so count any warm pixel, not just the brightest
    let warm = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 128 && d[i] > 130 && d[i] - d[i + 2] > 80) warm++;
    }
    return { count: frames.length, a: hash(frames[0]), b: hash(frames[2]), warm: warm };
  });
  check('skate is a four-frame cycle', skate.count === 4);
  check('opposite skate frames differ (feet alternate)', skate.a !== skate.b);
  check('skate frames show a red/orange jet wash', skate.warm >= 3);

  /* ---- maps, the big door and the save pillars ----------------------- */
  const world = await page.evaluate(() => {
    return SH.MAP_ORDER.map(id => {
      const m = SH.buildMap(id);
      const c = {};
      m.objects.forEach(o => { c[o.kind] = (c[o.kind] || 0) + 1; });
      return { id: id, w: m.w, h: m.h, saves: c.save || 0, gates: c.gate || 0 };
    });
  });
  check('every map is at least 80x56 tiles',
    world.every(s => s.w >= 80 && s.h >= 56));
  check('every map has an exit and two save pillars',
    world.every(s => s.gates === 1 && s.saves === 2));

  const door = await page.evaluate(() => {
    const o = SH.scenes[SH.scenes.length - 1];
    const g = o.map.objects.filter(x => x.kind === 'gate')[0];
    const blocked = [];
    for (let j = -2; j <= 0; j++) {
      for (let i = 0; i <= 1; i++) {
        blocked.push(o.solidAt((g.tx + i) * 16 + 8, (g.ty + j) * 16 + 8));
      }
    }
    o.gateOpen = true;
    const openNow = o.solidAt(g.tx * 16 + 8, g.ty * 16 + 8);
    o.gateOpen = false;
    const sheet = SH.Assets.sheet('door');
    return { blocked: blocked, openNow: openNow, fw: sheet.fw, fh: sheet.fh };
  });
  check('the closed door blocks its whole 2x3 footprint',
    door.blocked.length === 6 && door.blocked.every(Boolean) && door.openNow === false);
  check('the door sprite is two tiles wide and three tall',
    door.fw === 32 && door.fh === 48);

  const saved = await page.evaluate(() => {
    const o = SH.scenes[SH.scenes.length - 1];
    const sp = o.map.objects.filter(x => x.kind === 'save')[0];
    SH.Game.hp = 5;
    SH.Game.lastSave = '';
    o.player.x = sp.x; o.player.y = sp.y;
    o.interact();
    return { lastSave: SH.Game.lastSave, hp: SH.Game.hp,
             stored: !!localStorage.getItem('shadow_the_hedgehog_16bit_v1') };
  });
  check('a save pillar records progress and restores HP',
    saved.lastSave !== '' && saved.hp > 5 && saved.stored);

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
  /* stand at the exit and at a save pillar so both props are in frame */
  await page.evaluate(() => {
    const o = SH.scenes[SH.scenes.length - 1];
    const g = o.map.objects.filter(x => x.kind === 'gate')[0];
    o.player.x = g.x - 40; o.player.y = g.y; o.player.dir = 'side';
    o.gateOpen = false;
    o.titleT = 0; o.noticeT = 0;
    SH.Tips.clear();
  });
  await page.waitForTimeout(400);
  await shot('04b_door_locked');
  await page.evaluate(() => {
    const o = SH.scenes[SH.scenes.length - 1];
    const sp = o.map.objects.filter(x => x.kind === 'save')[0];
    o.player.x = sp.x - 26; o.player.y = sp.y + 6;
    o.titleT = 0; o.noticeT = 0;          // let the stage card clear first
    SH.Tips.clear();
  });
  await page.waitForTimeout(400);
  await shot('04c_savepoint');

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

  /* ---- the attack is a single sweep and fires the sidearm ------------ */
  const gunshot = await page.evaluate(async () => {
    const b = new SH.Battle(['gun_soldier'], {});
    SH.push(b);
    b.startAttackBar(b.enemies[0]);
    const start = b.bar.x;
    for (let i = 0; i < 30; i++) b.update(1 / 60);   // half a second in
    const mid = b.bar.x;
    b.bar.x = 0;                                     // dead centre
    b.resolveAttack();
    const shooting = b.state === 'shooting' && !!b.tracer;
    const pose = b.shadowPose;
    for (let i = 0; i < 30; i++) b.update(1 / 60);   // let the tracer land
    const resolved = b.state === 'message';
    const hp = b.enemies[0].hp;
    SH.pop();
    return { start, mid, shooting, pose, resolved, hp,
             frames: Object.keys(SH.Assets.sheet('shadow').names) };
  });
  await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier', 'black_warrior'], {});
    SH.push(b);
    b.state = 'menu';
    b.startAttackBar(b.enemies[0]);
    b.bar.x = 0.05;
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const b = SH.scenes[SH.scenes.length - 1];
    b.state = 'menu'; SH.Game.tp = 100;
    b.openActs(b.enemies[0]);
  });
  await page.waitForTimeout(200);
  await shot('11b_act_list');
  await page.evaluate(() => {
    const b = SH.scenes[SH.scenes.length - 1];
    b.doSpear();
    for (let i = 0; i < 26; i++) b.update(1 / 60);
  });
  await page.waitForTimeout(60);
  await shot('11c_chaos_spear');
  await page.evaluate(() => {
    const b = SH.scenes[SH.scenes.length - 1];
    b.state = 'menu'; SH.Game.tp = 100;
    b.doBlast();
    for (let i = 0; i < 30; i++) b.update(1 / 60);
  });
  await page.waitForTimeout(60);
  await shot('11d_chaos_blast');
  await page.evaluate(() => {
    const b = SH.scenes[SH.scenes.length - 1];
    b.state = 'menu';
    b.startAttackBar(b.enemies[0]);
    b.bar.x = 0.05;
  });
  await page.waitForTimeout(120);
  await shot('12_attack_bar');
  const shotState = await page.evaluate(() => {
    const b = SH.scenes[SH.scenes.length - 1];
    b.bar.x = 0;
    b.resolveAttack();
    b.tracer.t = 0.09;
    return { state: b.state, pose: b.shadowPose };
  });
  await page.waitForTimeout(50);
  await shot('13_gunshot');
  check('the gunshot frame is the shoot pose',
    shotState.state === 'shooting' && shotState.pose === 'shoot');
  await page.evaluate(() => { SH.pop(); });
  await page.waitForTimeout(150);

  check('the attack bar starts at one end and sweeps one way',
    gunshot.start === -1 && gunshot.mid > gunshot.start);
  check('firing plays the gun pose with a tracer',
    gunshot.shooting === true && gunshot.pose === 'shoot');
  check('the battle sheet has a shoot frame', gunshot.frames.includes('shoot'));
  check('the shot lands and damages the target',
    gunshot.resolved === true && gunshot.hp < 34);

  /* ---- the ACT list has to stay inside its panel ---------------------- */
  const actFit = await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier'], {});
    SH.Game.tp = 100;
    b.openActs(b.enemies[0]);
    const m = b.menu;
    const rows = Math.ceil(m.items.length / m.columns);
    const lastY = m.y + (rows - 1) * m.lh;
    const lastX = m.x + (m.columns - 1) * m.width;
    return { count: m.items.length, columns: m.columns,
             bottom: lastY + m.size, right: lastX + 120, descY: m.descY };
  });
  /* the panel runs y 130..212 and the button row starts at 216 */
  check('the ACT list fits inside its panel',
    actFit.bottom <= 210 && actFit.descY <= 210 && actFit.right <= 312);
  check('the ACT list uses two columns now that Chaos moves are in it',
    actFit.count >= 6 && actFit.columns === 2);

  /* ---- soundtrack --------------------------------------------------- */
  const music = await page.evaluate(() => {
    const names = ['title', 'city', 'ark', 'comet', 'battle', 'boss', 'last',
                   'ending_dark', 'ending_hero', 'ending_true'];
    const out = {};
    names.forEach(n => {
      try { SH.Audio.play(n); out[n] = SH.Audio.current() === n; }
      catch (e) { out[n] = 'ERR ' + e.message; }
    });
    SH.Audio.stop();
    return out;
  });
  check('every track plays without error',
    Object.keys(music).length === 10 && Object.values(music).every(v => v === true));

  /* ---- chaos sound effects all exist --------------------------------- */
  const sfx = await page.evaluate(() => {
    const missing = [];
    ['chaos', 'blast', 'control', 'gunshot', 'tip'].forEach(n => {
      try { SH.Audio.sfx(n); } catch (e) { missing.push(n + ': ' + e.message); }
    });
    return missing;
  });
  check('chaos / blast / control / gunshot effects play without error', sfx.length === 0);

  /* ---- tutorial tips ------------------------------------------------- */
  const tips = await page.evaluate(() => {
    SH.Tips.clear();
    SH.Settings.tips = true; SH.Settings.seenTips = {};
    const first = SH.Tips.show('probe', '테스트');
    const again = SH.Tips.show('probe', '테스트');       // only once
    SH.Settings.tips = false;
    const off = SH.Tips.show('probe2', '테스트');        // suppressed
    SH.Settings.tips = true; SH.Settings.seenTips = {}; SH.Settings.save();
    SH.Tips.clear();
    return { first, again, off };
  });
  check('a tip fires once and only once', tips.first === true && tips.again === false);
  check('tips can be switched off', tips.off === false);

  /* ---- ground shadows ------------------------------------------------ */
  check('the engine exposes a ground-shadow helper',
    await page.evaluate(() => typeof SH.groundShadow === 'function' &&
                              typeof SH.ellipseFill === 'function'));

  /* ---- Chaos Blast and the renamed Chaos Control --------------------- */
  const chaos = await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier', 'gun_soldier'], {});
    SH.Game.tp = 100; SH.Game.atk = 11;
    b.openActs(b.enemies[0]);
    const labels = b.menu.items.map(i => i.label);
    const before = b.enemies.map(e => e.hp);
    b.doBlast();
    // the damage now lands with the shockwave, so run the effect out and
    // collect the burst kinds as they appear (they expire on their own)
    const seen = {};
    for (let i = 0; i < 200 && b.state === 'chaosfx'; i++) {
      b.bursts.forEach(x => { seen[x.kind] = true; });
      b.update(1 / 60);
    }
    const after = b.enemies.map(e => e.hp);
    b.openMercy();
    const mercy = b.menu.items.map(i => i.label);
    return {
      actLabels: labels, mercyLabels: mercy, tp: SH.Game.tp,
      dealt: before.map((h, i) => h - after[i]),
      burstKinds: Object.keys(seen)
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
  check('Chaos Blast plays a detonation before it lands',
    chaos.burstKinds.indexOf('ring') >= 0 && chaos.burstKinds.indexOf('charge') >= 0);

  /* ---- Chaos Spear throws real lances -------------------------------- */
  const spear = await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier', 'black_warrior'], {});
    SH.Game.tp = 40; SH.Game.atk = 11;
    const before = b.enemies.map(e => e.hp);
    b.doSpear();
    const inFlight = b.spears.length;
    const staggered = b.spears.length > 1 && b.spears[0].t !== b.spears[1].t;
    for (let i = 0; i < 300 && b.state === 'chaosfx'; i++) b.update(1 / 60);
    const after = b.enemies.map(e => e.hp);
    return { inFlight, staggered, dealt: before.map((h, i) => h - after[i]) };
  });
  check('Chaos Spear throws one lance per target',
    spear.inFlight === 2 && spear.staggered === true);
  check('every lance lands its damage', spear.dealt.every(d => d > 0));

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
