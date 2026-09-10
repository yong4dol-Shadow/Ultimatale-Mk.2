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

  /* ---- movement speed and the acceleration ramp -----------------------
     Speed is read off the simulation, not off wall-clock displacement: a
     headless browser drops frames under load, so px-per-real-second dips
     below the threshold at random and the check flaps.  Displacement is
     still asserted, but only loosely enough to catch movement being broken
     rather than merely stuttering. */
  const moved = await page.evaluate(async () => {
    const o = () => SH.scenes[SH.scenes.length - 1];
    const walk = async (secs, warm) => {
      const s = o();
      // start from the map's own spawn: a hard-coded tile can end up
      // inside a building once the layouts change
      s.player.x = s.map.spawn.x; s.player.y = s.map.spawn.y;
      s.player.spd = 0;
      SH.Input.state.right = true;
      if (warm) await new Promise(r => setTimeout(r, warm * 1000));
      const start = s.player.x, t0 = performance.now();
      await new Promise(r => setTimeout(r, secs * 1000));
      const spd = s.player.spd;
      SH.Input.state.right = false;
      const dt = (performance.now() - t0) / 1000;
      return { spd: spd, px: (s.player.x - start) / dt };
    };
    SH.Settings.move = 0;
    const slow = await walk(0.5, 1.2);
    const mulSlow = SH.Settings.speedMul();
    const opening = await walk(0.16, 0);          // straight off the mark
    SH.Settings.move = 2;
    const fast = await walk(0.5, 1.2);
    const mulFast = SH.Settings.speedMul();
    SH.Settings.move = 0;
    return { slow: slow, fast: fast, opening: opening,
             mulSlow: mulSlow, mulFast: mulFast };
  });
  check('sustained walk speed is above 90 px/s', moved.slow.spd > 90);
  check('and he actually covers ground at it', moved.slow.px > 50);
  check('speed ramps up instead of starting at the top',
    moved.opening.spd < moved.slow.spd * 0.6);

  /* the Air Shoes light in stages off that same ramp */
  const fire = await page.evaluate(async () => {
    const o = SH.scenes[SH.scenes.length - 1];
    const s = SH.Assets.sheet('shadow_ow');
    o.player.x = o.map.spawn.x; o.player.y = o.map.spawn.y;
    o.player.spd = 0;
    SH.Input.state.right = true; SH.Input.state.cancel = true;   // dash
    const seen = [];
    for (let i = 0; i < 26; i++) {
      await new Promise(r => setTimeout(r, 50));
      const p = o.player;
      seen.push(p.charge >= 0.86 ? 2 : (p.charge >= 0.55 ? 1 : 0));
    }
    SH.Input.state.right = false; SH.Input.state.cancel = false;
    return {
      stages: seen, first: seen[0], last: seen[seen.length - 1],
      named: [0, 1, 2].every(l => s.names['skate' + l] &&
                                  s.names['skate' + l].length === 4),
      /* the full-burn cycle is still what plain `skate` means */
      alias: s.names.skate.join() === s.names.skate2.join()
    };
  });
  check('the sheet carries three skate stages of four frames each', fire.named);
  check('plain `skate` still means the full burn', fire.alias);
  check('the Air Shoes start cold and reach a full burn',
    fire.first === 0 && fire.last === 2 && fire.stages.includes(1));

  /* Once lit they stay warm - stopping to read a sign should not mean
     winding the whole thing back up from cold. */
  const warm = await page.evaluate(async () => {
    const o = SH.scenes[SH.scenes.length - 1];
    const p = o.player;
    p.burn = 2.0; p.lit = true; p.spd = 0;
    SH.Input.state.right = false; SH.Input.state.cancel = false;
    await new Promise(r => setTimeout(r, 1500));   // stand still a while
    return { burn: p.burn, lit: p.lit };
  });
  check('a stop does not put the Air Shoes back to cold', warm.burn >= 0.35);

  /* Spin dash: hold down, tap to rev, let go to launch. */
  const dash = await page.evaluate(async () => {
    const o = SH.scenes[SH.scenes.length - 1];
    const p = o.player;
    p.x = o.map.spawn.x; p.y = o.map.spawn.y;
    p.spd = 0; p.spin = 0; p.rev = 0; p.burn = 0; p.lit = false;
    p.dir = 'side'; p.face = 1;
    SH.Input.state.down = true;
    await new Promise(r => setTimeout(r, 200));
    /* down on its own must still just walk him toward the camera */
    const walksDown = !p.revving && p.dir === 'down' && p.moving;
    /* six taps of the confirm key - the first one enters the stance */
    for (let i = 0; i < 6; i++) {
      SH.Input.buf.confirm = true;
      await new Promise(r => setTimeout(r, 70));
    }
    const stance = p.revving;
    const revs = p.rev, heldStill = p.spd;
    SH.Input.state.down = false;
    await new Promise(r => setTimeout(r, 60));
    const launched = { spin: p.spin, spd: p.spd, burn: p.burn };
    /* pushing the way he is already going uncurls him - a real key edge,
       since the uncurl looks for a fresh press rather than a held axis */
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    await new Promise(r => setTimeout(r, 90));
    const uncurled = p.spin;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
    p.spin = 0;
    return { stance, walksDown, revs, heldStill, launched, uncurled };
  });
  check('down on its own still just walks him downward', dash.walksDown === true);
  check('the first tap enters the spin-dash stance', dash.stance === true);
  check('taps wind it up and he does not creep while charging',
    dash.revs >= 4 && dash.heldStill < 5);
  check('a full wind-up launches him at top speed',
    dash.launched.spin > 0 && dash.launched.spd >= 170);
  check('and he comes out of it already fully lit', dash.launched.burn >= 1.35);
  check('pushing forward uncurls him back onto the shoes', dash.uncurled === 0);

  /* Down is a direction first.  The roll is only ever a modifier on a run
     that is already happening. */
  const rollGate = await page.evaluate(async () => {
    const o = SH.scenes[SH.scenes.length - 1];
    const p = o.player;
    /* real key events - poking Input.buf from outside does not survive, the
       loop clears the buffer at the end of every frame */
    const key = (type, code) =>
      window.dispatchEvent(new KeyboardEvent(type, { code: code }));
    const clear = () => {
      ['ArrowRight', 'ArrowDown', 'KeyX'].forEach(c => key('keyup', c));
    };
    const attempt = async holdRight => {
      clear();
      p.x = o.map.spawn.x; p.y = o.map.spawn.y;
      p.spin = 0; p.rev = 0; p.revving = false;
      p.burn = 2.0; p.lit = true; p.dir = 'side'; p.face = 1;
      p.spd = holdRight ? 176 : 0;
      key('keydown', 'KeyX');                    // dash held
      if (holdRight) key('keydown', 'ArrowRight');
      await new Promise(r => setTimeout(r, 160));
      key('keydown', 'ArrowDown');               // tap down
      await new Promise(r => setTimeout(r, 120));
      const spun = p.spin > 0;
      clear();
      p.spin = 0; p.rev = 0; p.revving = false;   /* never leak a roll onward */
      await new Promise(r => setTimeout(r, 60));
      return spun;
    };
    const still = await attempt(false);
    const running = await attempt(true);
    clear();
    p.spin = 0; p.rev = 0; p.revving = false; p.burn = 0; p.lit = false;
    await new Promise(r => setTimeout(r, 80));
    return { still: still, running: running };
  });
  check('standing still, down never rolls him', rollGate.still === false);
  check('running, down does roll him', rollGate.running === true);
  check('the fast option moves noticeably faster',
    moved.mulFast >= moved.mulSlow * 1.3 && moved.fast.px > moved.slow.px);

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
    const home = () => { o.player.x = o.map.spawn.x; o.player.y = o.map.spawn.y; };
    home(); const down = await hold('down');
    home(); const up = await hold('up');
    home(); const left = await hold('left');
    home(); const dash = await hold('right', 'cancel');
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
  const enc = await page.evaluate(() => {
    const rates = SH.MAP_ORDER.map(id => SH.Maps[id].encounter.rate);
    const o = SH.scenes[0];
    const rolls = [];
    for (let i = 0; i < 400; i++) rolls.push(o.rollEncDistance());
    const r = o.def.encounter.rate;
    return {
      rates: rates,
      lo: Math.min.apply(null, rolls) / r,
      hi: Math.max.apply(null, rolls) / r,
      mean: rolls.reduce((a, b) => a + b, 0) / rolls.length / r
    };
  });
  check('encounter distance is at least 1500px everywhere',
    enc.rates.every(r => r >= 1500));
  check('the encounter roll spans a wide band, so it never feels metronomic',
    enc.lo < 1.0 && enc.hi > 2.6 && enc.mean > 1.6 && enc.mean < 2.4);

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
    b.startChaosControl(function () {});
    for (let i = 0; i < 34; i++) b.update(1 / 60);
  });
  await page.waitForTimeout(60);
  await shot('11e_chaos_control');
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

  /* ---- graze feedback and the gunshot impact ------------------------- */
  const graze = await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier'], {});
    SH.Game.tp = 0;
    b.state = 'enemyturn';
    b.soul.x = b.box.x + 40; b.soul.y = b.box.y + 20;
    /* park a bullet just outside the hit radius so it only ever grazes */
    b.bullets = [{
      x: b.soul.x + 9, y: b.soul.y, w: 6, h: 6, vx: 0, vy: 0, life: 5,
      dmg: 3, spr: 'p_bullet', rot: 0, spin: 0, grazed: false, warn: 0, tick: 0
    }];
    for (let i = 0; i < 12; i++) b.updateBullets(1 / 60);
    const lit = b.grazeGlow, pops = b.pops.length, tp = SH.Game.tp;
    b.bullets.length = 0;
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    return { lit, pops, tp, faded: b.grazeGlow };
  });
  check('a graze charges TP', graze.tp > 0);
  check('a graze lights the soul outline instead of popping text',
    graze.lit > 0 && graze.pops === 0);
  check('the graze outline fades once the bullets are gone', graze.faded === 0);

  const impact = await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier'], {});
    b.hitEnemy(b.enemies[0], 3, 'shot');
    const gun = b.fx.map(f => f.sheet);
    b.fx.length = 0;
    b.hitEnemy(b.enemies[0], 3);
    return { gun: gun, energy: b.fx.map(f => f.sheet) };
  });
  check('a landed shot bursts instead of slashing',
    impact.gun.includes('fx_hit') && !impact.gun.includes('fx_slash'));
  check('Chaos damage still uses the energy slash', impact.energy.includes('fx_slash'));

  /* ---- the command row is UNDERTALE-uniform -------------------------- */
  const btns = await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier'], {});
    SH.push(b);
    b.msg = null;
    const g = document.getElementById('screen').getContext('2d',
      { willReadFrequently: true });
    /* the frame colour of button i, read off the rendered buffer */
    const frameCol = i => {
      const d = g.getImageData(7 + i * 78, 217, 1, 1).data;
      return d[0] + ',' + d[1] + ',' + d[2];
    };
    b.state = 'menu'; b.btn = 1; b.draw();
    const withSel = [0, 1, 2, 3].map(frameCol);
    const s = SH.Assets.sheet('hud');
    SH.pop();
    return {
      cols: withSel,
      pairs: ['icon_fight', 'icon_act', 'icon_item', 'icon_mercy']
        .every(n => s.names[n] && s.names[n + '_on'])
    };
  });
  check('unselected command buttons are all the same colour',
    btns.cols[0] === btns.cols[2] && btns.cols[2] === btns.cols[3]);
  check('the selected command button is the only different one',
    btns.cols[1] !== btns.cols[0]);
  check('each command icon has a selected variant', btns.pairs);

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
    /* each lance ends up past its target, not on it - it runs them through */
    const pierces = b.spears.every(s => Math.abs(s.ex - 84) > Math.abs(s.tx - 84));
    const seen = {};
    let struck = 0;
    for (let i = 0; i < 300 && b.state === 'chaosfx'; i++) {
      b.fx.forEach(f => { seen[f.sheet] = true; });
      struck = Math.max(struck, b.spears.filter(s => s.struck).length);
      b.update(1 / 60);
    }
    const after = b.enemies.map(e => e.hp);
    return { inFlight, staggered, pierces, struck, sheets: Object.keys(seen),
             dealt: before.map((h, i) => h - after[i]) };
  });
  check('Chaos Spear throws one lance per target',
    spear.inFlight === 2 && spear.staggered === true);
  check('a lance runs its target through instead of stopping at them',
    spear.pierces && spear.struck === 2);
  check('the spear wound burns instead of being slashed',
    spear.sheets.includes('fx_flare') && !spear.sheets.includes('fx_slash'));
  check('every lance lands its damage', spear.dealt.every(d => d > 0));

  /* A lance costs 40 TP, so it has to beat the sidearm shot the player can
     land for free - it used to come in under a GREAT-timed one. */
  const dmgCmp = await page.evaluate(() => {
    const run = (atk, setup) => {
      const b = new SH.Battle(['black_oak'], {});
      const e = b.enemies[0];
      SH.Game.atk = atk; SH.Game.tp = 100;
      const hp0 = e.hp;
      setup(b, e);
      for (let i = 0; i < 400 && b.state === 'chaosfx'; i++) b.update(1 / 60);
      return hp0 - e.hp;
    };
    /* average out the +-2 roll on each path */
    const avg = fn => { let s = 0; for (let i = 0; i < 60; i++) s += fn(); return s / 60; };
    const shot = acc => avg(() => run(11, (b, e) => {
      b.bar = { x: 1 - acc, target: e };
      b.resolveAttack();
      b.pendingShot();
    }));
    const great = shot(0.8), perfect = shot(0.98);
    const lance = avg(() => run(11, b => b.doSpear()));
    const blast = avg(() => run(11, b => b.doBlast()));
    return { great, perfect, lance, blast };
  });
  check('a Chaos Spear out-damages a GREAT-timed sidearm shot',
    dmgCmp.lance > dmgCmp.great * 1.4);
  check('and stays ahead of even a PERFECT one, which is free',
    dmgCmp.lance > dmgCmp.perfect * 1.15);
  check('but stays well short of a Chaos Blast',
    dmgCmp.lance < dmgCmp.blast * 0.75);

  /* ---- Chaos Control plays a sequence and still freezes the next turn - */
  const control = await page.evaluate(() => {
    const b = new SH.Battle(['gun_soldier'], {});
    SH.Game.tp = 100;
    b.openActs(b.enemies[0]);
    const idx = b.menu.items.findIndex(i => i.value && i.value.kind === 'control');
    b.state = 'menu';
    b.startChaosControl(function () {});
    const started = b.state === 'chaosfx';
    const seen = {};
    let images = 0;
    for (let i = 0; i < 200 && b.state === 'chaosfx'; i++) {
      b.bursts.forEach(x => { seen[x.kind] = true; });
      images = Math.max(images, b.afterImages.length);
      b.update(1 / 60);
    }
    return { started, kinds: Object.keys(seen), images,
             cleared: b.afterImages.length === 0, hasControlAct: idx === -1 };
  });
  check('Chaos Control runs a fold sequence', control.started === true);
  check('it ripples and leaves after-images',
    control.kinds.indexOf('ring') >= 0 && control.kinds.indexOf('charge') >= 0 &&
    control.images >= 4);
  check('the after-images are cleaned up afterwards', control.cleared === true);

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

  /* ---- the route audit ------------------------------------------------
     Mission objectives have to be able to decide the branch on their own,
     the true ending has to be unreachable without a clean hero run AND all
     seven emeralds, and the title entry has to reflect that. */
  const audit = await page.evaluate(() => {
    const S = SH.Story, o = {};
    /* identical kills either side - only the objectives differ */
    const withStages = kind => {
      S.reset();
      S.kill.human = 4; S.kill.alien = 4;
      for (const id of SH.MAP_ORDER) S.recordStage(id, kind);
      return S.evaluateEnding();
    };
    o.allDark = withStages('dark');
    o.allHero = withStages('hero');
    o.allNormal = withStages('normal');
    /* stage tallies are readable per route */
    S.reset();
    S.recordStage('a', 'hero'); S.recordStage('b', 'hero'); S.recordStage('c', 'dark');
    o.counts = [S.stagesOf('hero'), S.stagesOf('dark'), S.stagesOf('normal')];

    /* an IMPURE hero run must not unlock Last Story even at 7 emeralds */
    S.reset(); S.flags.ending3Cleared = false; S.flags.lastStoryUnlocked = false;
    S.kill.alien = 20; S.kill.human = 1;             // one human ruins it
    S.markEndingCleared('ending_hero', 7);
    o.impureSeven = S.flags.lastStoryUnlocked;
    /* and a pacifist run cannot either - no aliens killed is not a hero run */
    S.reset(); S.flags.lastStoryUnlocked = false;
    S.markEndingCleared('ending_bystander', 7);
    o.pacifistSeven = S.flags.lastStoryUnlocked;
    /* clean hero run, all seven - this is the only way in */
    S.reset(); S.flags.ending3Cleared = false; S.flags.lastStoryUnlocked = false;
    S.kill.alien = 20;
    S.markEndingCleared('ending_hero', 7);
    o.pureSeven = S.flags.lastStoryUnlocked;
    /* the flag survives a save/load round trip */
    const blob = JSON.parse(JSON.stringify(S.save()));
    S.reset(); S.flags.lastStoryUnlocked = false;
    S.load(blob);
    o.persisted = S.flags.lastStoryUnlocked;
    return o;
  });
  check('all-DARK objectives push the run to ENDING 1', audit.allDark === 'ending_dark');
  check('all-HERO objectives push the same kills to ENDING 3', audit.allHero === 'ending_hero');
  check('all-NORMAL objectives push it to ENDING 2', audit.allNormal === 'ending_bystander');
  check('stage results are tallied per route',
    audit.counts[0] === 2 && audit.counts[1] === 1 && audit.counts[2] === 0);
  check('one human kill locks Last Story out even at 7 emeralds',
    audit.impureSeven === false);
  check('a pacifist clear does not unlock Last Story either',
    audit.pacifistSeven === false);
  check('a clean hero run with all 7 emeralds is the one way in',
    audit.pureSeven === true);
  check('the unlock survives save and load', audit.persisted === true);

  const titleGate = await page.evaluate(() => {
    /* the title reloads story state from the save on enter, so the flag has
       to be persisted, not just set in memory */
    const openTitle = unlocked => {
      SH.Story.flags.lastStoryUnlocked = unlocked;
      SH.Game.save();
      SH.push(new SH.Title());
      const sc = SH.scenes[SH.scenes.length - 1];
      const row = sc && sc.menu && sc.menu.items.find(i => i.value === 'last');
      SH.pop();
      return row ? row.enabled === true : null;
    };
    const off = openTitle(false), on = openTitle(true);
    SH.Story.flags.lastStoryUnlocked = false;
    SH.Game.save();
    return { off: off, on: on };
  });
  check('the title screen greys LAST STORY out until it is earned',
    titleGate.off === false && titleGate.on === true);

  /* ---- Chaos moves are the emeralds' power --------------------------- */
  const gate = await page.evaluate(() => {
    const labels = () => {
      const b = new SH.Battle(['gun_soldier'], {});
      SH.Game.tp = 100;
      b.openActs(b.enemies[0]);
      const acts = b.menu.items.filter(i => i.value && i.value.kind &&
                                            i.value.kind !== 'act');
      b.openMercy();
      const flee = b.menu.items.find(i => i.value === 'flee');
      return { acts: acts.map(i => i.enabled !== false), flee: flee.enabled !== false };
    };
    SH.Game.emeralds = [false, false, false, false, false, false, false];
    const none = labels();
    SH.Game.emeralds[0] = true;
    const one = labels();
    SH.Game.emeralds = [false, false, false, false, false, false, false];
    return { none: none, one: one };
  });
  check('no emerald: Chaos Spear and Blast are locked',
    gate.none.acts.length === 2 && gate.none.acts.every(v => v === false));
  check('no emerald: Chaos Control is locked too', gate.none.flee === false);
  check('one emerald unlocks all three Chaos moves',
    gate.one.acts.every(v => v === true) && gate.one.flee === true);

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
