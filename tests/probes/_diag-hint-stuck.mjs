/**
 * _diag-hint-stuck.mjs — 复现「按 [E] 查看」底部提示卡住（一直停在屏幕上）
 * 覆盖现有 _diag-hint-residue 未测的两种字面"查看"：
 *   后山老树（forest 按 E 查看）+ 小镇星光艺术展素材箱/夏雅（town 按 E 查看）
 * 行为：靠近 → hint 应显示；远离 / 交互后 → hint 应消失。
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function seedSave(scene, x, y, extra = {}) {
  return {
    version: '0.5', savedAt: 'diag', timestamp: Date.now(),
    player: { x, y, scene, facing: 'down', inventory: {} },
    world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'in_progress', ch1TownIntroDone: true },
    chapter: 1, worldRestore: {},
    gameState: { triggeredEvents: {} },
    ...extra,
  };
}

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

async function boot(scene, x, y, extra) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1200);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), seedSave(scene, x, y, extra));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(1000);
  for (let i = 0; i < 30; i++) {
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === scene) break;
    await sleep(250);
  }
  await sleep(1200);
}

async function listHints(label) {
  const hints = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div'))
      .filter((d) => d.style.position === 'fixed' && /按 \[E\]|点击「交互」/.test(d.textContent || ''))
      .map((d) => (d.textContent || '').trim()).filter((t) => t.length > 0);
  });
  console.log(`[${label}]`, JSON.stringify(hints));
  return hints;
}

async function moveTo(x, y) {
  let ok = false, err = '';
  try {
    ok = await page.evaluate(([xx, yy]) => {
      const sc = window.__game.scene.getScenes(true);
      const s = sc.find((e) => e && e.player && typeof e.player.x === 'number' && e.player.body);
      if (!s) return false;
      s.player.x = xx; s.player.y = yy;
      return true;
    }, [x, y]);
  } catch (e) { err = String(e); }
  if (!ok) console.log(`  !! 未找到带 player 的场景 ${err}`.trim());
  await sleep(400);
}

async function activeScene() {
  let out = {};
  try {
    out = await page.evaluate(() => {
      const sc = window.__game.scene.getScenes(true);
      const playerScene = sc.find((e) => e && e.player && typeof e.player.x === 'number')?.scene?.key ?? 'none';
      return { active: sc.map((e) => e?.scene?.key ?? '?'), playerScene };
    });
  } catch (e) { out = { error: String(e) }; }
  return out;
}

async function keys(names) {
  for (const n of names) { await page.keyboard.press(n); await sleep(120); }
}

try {
  // ═══ 后山老树（forest (136,136)，半径60）═══
  console.log('════ 后山老树 ════');
  await boot('forest', 136, 136, {});
  await moveTo(136, 136); await listHints('靠近老树');
  await moveTo(400, 300); await listHints('远离老树');
  await moveTo(136, 136); await listHints('再靠近');
  await keys(['e']); await sleep(1200); await listHints('按E之后');
  await moveTo(400, 300); await listHints('按E后远离');

  // ═══ 小镇星光艺术展素材箱/夏雅（town，筹备期 artShowHeld=false）═══
  console.log('════ 小镇艺术展 ════');
  await boot('town', 400, 300, {
    mapFlags: { artShowUnlocked: true, artShowEnvStage: 3, artShowMaterialsDone: true, artShowHeld: false, artShowPerm: false },
  });
  const target = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    const box = s.artShowBox ? { x: s.artShowBox.x, y: s.artShowBox.y } : null;
    const xiya = s.artShowXiya ? { x: s.artShowXiya.x, y: s.artShowXiya.y } : null;
    return { box, xiya, unlocked: s.artShowUnlocked, held: s.artShowHeld };
  });
  console.log('artShow state:', JSON.stringify(target));
  console.log('scenes:', JSON.stringify(await activeScene()));
  console.log('ARTSHOW consts:', await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return { has: !!s.constructor.ARTSHOW };
  }));
  const prox = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return {
      player: { x: s.player.x, y: s.player.y },
      boxStatic: s.constructor.ARTSHOW && s.constructor.ARTSHOW.box,
      boxInst: s.artShowBox ? { x: s.artShowBox.x, y: s.artShowBox.y } : null,
      hint: s.artShowHint ? s.artShowHint.textContent : null,
      held: s.artShowHeld,
    };
  });
  console.log('prox-before:', JSON.stringify(prox));
  const showAt = target.box || target.xiya;
  if (showAt) {
    await moveTo(showAt.x + 2, showAt.y + 2); await listHints('靠近素材箱(筹备期)');
    // 手动调用（绕过 update 门禁），确认逻辑本身是否显示提示
    const manual = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      try { s.checkArtShowProximity(); } catch (e) { return { err: String(e) }; }
      return {
        player: { x: s.player.x, y: s.player.y },
        dist2: (s.player.x - s.constructor.ARTSHOW.box.x) ** 2 + (s.player.y - s.constructor.ARTSHOW.box.y) ** 2,
        hint: s.artShowHint ? s.artShowHint.textContent : null,
      };
    });
    console.log('手动 checkArtShowProximity:', JSON.stringify(manual));
    await moveTo(showAt.x + 60, showAt.y + 60); await listHints('远离素材箱(筹备期)');
    // 复现 artShowHeld 提前 return 不隐藏：在靠近、提示显示时把 held 置 true
    await moveTo(showAt.x + 2, showAt.y + 2); await listHints('再靠近');
    await page.evaluate(() => { window.__game.scene.getScenes(true)[0].artShowHeld = true; });
    await moveTo(showAt.x + 80, showAt.y + 80);
    await listHints('held=true 后远离（期待消失）');
  } else {
    console.log('!! 素材箱未生成，跳过');
  }

  console.log('ERRORS', JSON.stringify(errors));
} finally {
  await browser.close();
}
process.exit(0);
