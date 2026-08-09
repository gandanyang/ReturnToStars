/**
 * P0-5 农场回暖（2026-08-08 制作人拍板）—— 运行时验证探针
 *
 * 验证（Level 2）：
 *   A 交付标记：questState=collected → town 与镇长交付 → questState=completed + worldRestore.farmWarm 入档
 *   B 回暖视觉：交付后进 farm → 暖橙 overlay + 光尘粒子生成（首屏过渡中 alpha < 0.1）
 *   C 过渡只播一次：读档（含 farmWarm + farm_warm_intro）重进 → overlay alpha 直接 = 0.1（不重播过渡）
 *   D 未交付（无 farmWarm）→ 无 overlay
 *   E 全程无运行时错误
 *
 * 前置：dev server；node tests/probes/probe-farm-warm.mjs
 * 说明：镇长白天（08-18）在 town，交付在 town 完成；随后改存档回 farm 验证视觉。
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
// 镇长 town 站位（SPOTS.town.elder）：col13,row10
const ELDER_T = { x: 13 * T + T / 2, y: 10 * T + T / 2 };
// farm 任意安全点
const FARM_POS = { x: 20 * T + T / 2, y: 10 * T + T / 2 };

const makeSave = (scene, x, y, { questState = 'not_started', worldRestore = {}, mapFlags = {}, gameState = {}, hour = 10, storyStep = 'done' } = {}) => ({
  version: '0.5', savedAt: 'farm-warm-probe', timestamp: Date.now(),
  player: { x, y, scene, facing: 'down', inventory: {} },
  world: { day: 2, hour, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true } },
  worldRestore,
  story: { storyStep },
  mapFlags: { sideXiyaGardenAsked: true, sideXiyaGardenDone: true, ...mapFlags },
  gameState: { triggeredEvents: { first_morning_response: true, ...gameState.triggeredEvents } },
});

async function run() {
  console.log('=== P0-5 农场回暖（星之碎片交付后环境反馈）运行时验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  const saveData = () => page.evaluate(() => JSON.parse(localStorage.getItem('return_star_save') || 'null'));
  const bodyText = () => page.evaluate(() => document.body.innerText);
  const farmState = () => page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    const s = g.scene.getScenes(true)[0];
    const ov = s?.farmWarmOverlay;
    return {
      key: s?.scene?.key ?? 'none',
      warmOverlay: !!ov,
      overlayAlpha: ov ? Number(ov.alpha.toFixed(2)) : -1,
      overlayW: ov ? Math.round(ov.displayWidth) : -1,
      overlayH: ov ? Math.round(ov.displayHeight) : -1,
      warmParticles: (s?.farmWarmParticles ?? []).length,
    };
  });

  const enterGame = async (scene, timeoutMs = 20000) => {
    const t0 = Date.now();
    let cur = '';
    while (Date.now() - t0 < timeoutMs) {
      cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (cur === scene) return;
      if (cur === 'title') {
        await page.keyboard.press('Enter');
        await page.mouse.click(400, 300);
      }
      await sleep(350);
    }
    throw new Error(`未能进入场景 ${scene}（实际 ${cur}）错误=${errors.slice(0, 5).join(' | ')}`);
  };

  const gotoScene = async (saveObj, expectScene) => {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), saveObj);
    await page.reload({ waitUntil: 'networkidle2' });
    await enterGame(expectScene);
    await sleep(1000);
  };

  const pressE = async () => {
    await page.keyboard.press('KeyE');
    await sleep(500);
  };

  const advanceUntilSeen = async (watchStrs, timeoutMs = 25000) => {
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const b = await bodyText();
      for (const s of watchStrs) if (b.includes(s)) seen.add(s);
      if (watchStrs.every((s) => seen.has(s))) break;
      await page.keyboard.press('Enter');
      await page.mouse.click(400, 300);
      await sleep(350);
    }
    return { allSeen: watchStrs.every((s) => seen.has(s)), seen: [...seen] };
  };

  const drainDialogue = async (pred, timeoutMs = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await pred()) return true;
      await page.keyboard.press('Enter');
      await page.mouse.click(400, 300);
      await sleep(300);
    }
    return false;
  };

  // ============ A 段：town 交付 → farmWarm 入档 ============
  console.log('--- A 交付（town 镇长，collected → completed）---');
  await gotoScene(makeSave('town', ELDER_T.x, ELDER_T.y, { questState: 'collected' }), 'town');
  await sleep(800);
  await pressE();
  let a = await advanceUntilSeen(['主线任务完成', '星之碎片（1']);
  check('A1 交付对白出现', a.allSeen, JSON.stringify(a.seen));
  check('A2 交付完成（questState=completed + worldRestore.farmWarm）', await drainDialogue(async () => {
    const d = await saveData();
    return d?.world?.questState === 'completed' && d?.worldRestore?.farmWarm === true;
  }), JSON.stringify({ qs: (await saveData())?.world?.questState, warm: (await saveData())?.worldRestore?.farmWarm }));

  // ============ B 段：回 farm 看回暖（首屏过渡中） ============
  console.log('\n--- B 回 farm 看回暖（交付后）---');
  // 取交付后存档，改位置回 farm（保留 questState/worldRestore）
  const postSave = await saveData();
  postSave.player.scene = 'farm';
  postSave.player.x = FARM_POS.x;
  postSave.player.y = FARM_POS.y;
  await gotoScene(postSave, 'farm');
  // 进 farm 后立刻（过渡 5s 尚未结束）检查 overlay 存在且 alpha 渐入中
  await sleep(300);
  let st = await farmState();
  // 覆盖断言：displayWidth/Height 必须是像素级（覆盖整张 farm 地图），
  // 否则 overlay 只是几十像素的不可见矩形（2026-08-09 截图暴露的回归点）。
  check('B1 暖橙 overlay + 光尘粒子已生成', st.warmOverlay === true && st.warmParticles >= 3, JSON.stringify(st));
  check('B2 覆盖像素级尺寸（≥640×240）', st.overlayW >= 640 && st.overlayH >= 240, `overlay=${st.overlayW}x${st.overlayH}`);
  check('B3 首屏过渡中（alpha < 0.1）', st.warmOverlay === true && st.overlayAlpha < 0.1 && st.overlayAlpha >= 0,
    `alpha=${st.overlayAlpha}`);

  // ============ C 段：过渡只播一次（读档重进直接应用） ============
  console.log('\n--- C 过渡只播一次（读档重进）---');
  await gotoScene(makeSave('farm', FARM_POS.x, FARM_POS.y, {
    questState: 'completed',
    worldRestore: { farmWarm: true },
    gameState: { triggeredEvents: { farm_warm_intro: true } },
  }), 'farm');
  await sleep(800);
  st = await farmState();
  check('C1 读档重进 overlay 直接全量（alpha=0.1）', st.warmOverlay === true && st.overlayAlpha === 0.1,
    `alpha=${st.overlayAlpha}`);

  // ============ D 段：未交付无回暖 ============
  console.log('\n--- D 未交付（无 farmWarm）→ 无 overlay ---');
  await gotoScene(makeSave('farm', FARM_POS.x, FARM_POS.y, { questState: 'not_started' }), 'farm');
  await sleep(800);
  st = await farmState();
  check('D1 未交付无 overlay', st.warmOverlay === false, JSON.stringify(st));

  // ============ E 段：运行时错误 ============
  check('\nE1 无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log(`\n========== 结果: ✅ ${pass} 通过 / ❌ ${fail} 失败 ==========`);
  if (fail > 0) process.exitCode = 1;
  await browser.close();
}

run().catch((err) => { console.error('探针异常:', err); process.exit(1); });
