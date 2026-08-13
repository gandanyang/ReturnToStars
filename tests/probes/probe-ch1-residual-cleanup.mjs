/**
 * probe-ch1-residual-cleanup.mjs — 第0章残留清理验证（[A-2]+[C-2] 体验债务修复）
 *
 * 验证项（2026-08-13 制作人拍板：chapter>=1 时第0章任务面板与镇长家提示应隐藏）：
 *   [A-2] 任务追踪卡 HUD（hudQuestDom）：chapter=0 显示 / chapter>=1 隐藏（display=none）
 *   [C-2] 镇长家提示（elderHouseHint）：chapter=0 在 town 显示 / chapter>=1 在 town 不生成
 *   附：无运行时错误 / 无 404
 *
 * 前置：dev server (localhost:5173) + window.__game / window.debug
 * 运行：node tests/probes/probe-ch1-residual-cleanup.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
const result = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
};

const errors = [];
const notFound = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });

const enterGame = async (scene, timeoutMs = 25000) => {
  const t0 = Date.now();
  let cur = '';
  while (Date.now() - t0 < timeoutMs) {
    try {
      cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
    } catch {
      await sleep(300);
      continue;
    }
    if (cur === scene) return;
    if (cur === 'title') {
      await page.keyboard.press('Enter');
      await page.mouse.click(400, 300);
    }
    try {
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find((d) => d.textContent?.includes('建议打开声音游玩'));
        if (el) { el.click(); return true; }
        return false;
      });
    } catch { /* ignore */ }
    await sleep(350);
  }
  throw new Error(`未能进入场景 ${scene}（实际 ${cur}）`);
};

const getHudDisplay = () => page.evaluate(() => {
  const s = window.__game?.scene?.getScenes(true)[0];
  const dom = s?.hudQuestDom;
  if (!dom) return { exists: false, display: 'no-dom' };
  return { exists: true, display: getComputedStyle(dom).display };
});

const getElderHint = () => page.evaluate(() => {
  const s = window.__game?.scene?.getScene('town');
  return {
    exists: !!s?.elderHouseHint,
    visible: s?.elderHouseHint?.sprite?.visible ?? false,
  };
});

const setChapter = (c) => page.evaluate((ch) => window.debug.setChapter(ch), c);
const gotoScene = async (key, spawn) => {
  await page.evaluate(([k, sp]) => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== k) g.scene.stop(active.scene.key);
    g.scene.start(k, sp ? { spawn: sp } : undefined);
  }, [key, spawn ?? null]);
  await sleep(2800);
};

// 第0章状态存档（未观星夜，hour=19 → 镇长在 elder_house，town 无镇长 → 提示应显示）
const CH0_SAVE = {
  version: '0.5', savedAt: 'residual-probe', timestamp: Date.now(),
  player: { x: 320, y: 460, scene: 'farm', facing: 'down', inventory: {} },
  world: { day: 1, hour: 19, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' },
  chapter: 0,
  gameState: { triggeredEvents: {} },
};

try {
  console.log('=== 第0章残留清理探针（[A-2]+[C-2]）===\n');

  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((save) => localStorage.setItem('return_star_save', JSON.stringify(save)), CH0_SAVE);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);
  await enterGame('farm');
  await sleep(800);

  // ========== A-2: 任务追踪卡 HUD ==========
  // 真实路径：chapter 切换发生在观星夜演出结束 + 场景切换，create() 会重跑 updateQuestHUD
  console.log('--- [A-2] 任务追踪卡 HUD ---');

  // A-2.1 chapter=0 时 HUD 应可见（farm 场景 create 时刷新）
  await setChapter(0);
  await gotoScene('farm', { x: 320, y: 460 });
  await sleep(500);
  let hud = await getHudDisplay();
  result('A-2.1 chapter=0 时 HUD 显示（display≠none）',
    hud.exists && hud.display !== 'none',
    `exists=${hud.exists} display=${hud.display}`);

  // A-2.2 chapter>=1 时 HUD 应隐藏（重进 farm 触发 create → updateQuestHUD）
  await setChapter(1);
  await gotoScene('farm', { x: 320, y: 460 });
  await sleep(500);
  hud = await getHudDisplay();
  result('A-2.2 chapter=1 时 HUD 隐藏（display=none）',
    hud.exists && hud.display === 'none',
    `exists=${hud.exists} display=${hud.display}`);

  // A-2.3 回到 chapter=0 后 HUD 恢复
  await setChapter(0);
  await gotoScene('farm', { x: 320, y: 460 });
  await sleep(500);
  hud = await getHudDisplay();
  result('A-2.3 回到 chapter=0 后 HUD 恢复显示',
    hud.exists && hud.display !== 'none',
    `exists=${hud.exists} display=${hud.display}`);

  // ========== C-2: 镇长家提示 ==========
  // 真实路径：镇长 06:00-08:00 / 18:00+ 在 elder_house，08:00-18:00 在 town
  // hour=19 → 镇长在 elder_house → town 无镇长 → chapter=0 应显示提示
  console.log('\n--- [C-2] 镇长家提示 ---');

  // C-2.1 chapter=0 时 town 应显示镇长家提示（hour=19 镇长在家）
  await setChapter(0);
  await page.evaluate(() => window.debug.setTime(19, 0));
  await sleep(300);
  await gotoScene('town', { x: 208, y: 296 });
  await sleep(800);
  let hint = await getElderHint();
  result('C-2.1 chapter=0 时 town 有镇长家提示（hour=19）',
    hint.exists && hint.visible,
    `exists=${hint.exists} visible=${hint.visible}`);

  // C-2.2 chapter=1 时 town 不应有镇长家提示
  await setChapter(1);
  await page.evaluate(() => window.debug.setTime(19, 0));
  await sleep(300);
  await gotoScene('farm', { x: 320, y: 460 });
  await sleep(400);
  await gotoScene('town', { x: 208, y: 296 });
  await sleep(800);
  hint = await getElderHint();
  result('C-2.2 chapter=1 时 town 无镇长家提示',
    !hint.exists || !hint.visible,
    `exists=${hint.exists} visible=${hint.visible}`);

  // C-2.3 回到 chapter=0 重进 town 应恢复提示
  await setChapter(0);
  await page.evaluate(() => window.debug.setTime(19, 0));
  await sleep(300);
  await gotoScene('farm', { x: 320, y: 460 });
  await sleep(400);
  await gotoScene('town', { x: 208, y: 296 });
  await sleep(800);
  hint = await getElderHint();
  result('C-2.3 回到 chapter=0 重进 town 恢复提示',
    hint.exists && hint.visible,
    `exists=${hint.exists} visible=${hint.visible}`);

  // ========== 附加：无错误 ==========
  console.log('\n--- 附加 ---');
  result('全程无运行时错误', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : '');
  result('无 404 资源', notFound.length === 0, notFound.length ? notFound.slice(0, 3).join(' | ') : '');

} catch (e) {
  console.log(`\n💥 探针异常：${e.message}`);
  console.log(e.stack);
  fail++;
} finally {
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
