/**
 * P1-3 夏雅《旧日留影》运行时验证探针（第一章剧情大纲 v0.3 §八）
 *
 * 验证：
 *   A. house 翻柜子入口：老屋整理完成后，柜子(10T,5T)出现"？"标记 → 靠近按 E →
 *      入口对白 → sideXiyaOldShadowAsked=true → 存档
 *   B. farm 老屋门口交付：翻出旧相框后，老屋修复状态下靠近老屋门口按 E →
 *      §八对白 → sideXiyaOldShadowDone=true → 存档
 *   C. 读档恢复：已完成后重进，事件不再触发
 *   D. 无运行时错误
 *
 * 前置：dev server (localhost:5173) + window.__game / window.debug
 * 运行：node tests/probes/probe-ch1-xiya-old-shadow.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
// house 柜子标记位置（setupXiyaOldShadow: 10*T, 5*T）
const CABINET_POS = { x: 10 * T, y: 5 * T };
// farm 老屋互动锚点（与 probe-t3 一致：oldHouseRestore.pos）
const OLD_HOUSE_POS = { x: 11 * T + T / 2, y: 20 * T + T / 2 };

/** 4 个老屋整理事件全完成（isHouseTidyComplete 派生依据） */
const TIDY_EVENTS = {
  ch1_bed_done: true,
  ch1_lamp_done: true,
  ch1_desk_done: true,
  ch1_radio_done: true,
  ch1_house_tidy_done: true,
};

const makeSave = (scene, x, y, opts = {}) => ({
  version: '0.5', savedAt: 'p13-old-shadow', timestamp: Date.now(),
  player: {
    x, y, scene, facing: 'down',
    inventory: { wood: 0, copper: 0 },
  },
  world: {
    day: 1, hour: 12, minute: 0, coins: 100, level: 1, xp: 0,
    stamina: 100, minedOres: [], questState: 'not_started',
  },
  farm: { tiles: [], crops: [], trees: [], restore: opts.restore ?? {} },
  story: { storyStep: 'done' },
  chapter: 1,
  mapFlags: opts.mapFlags,
  gameState: {
    triggeredEvents: {
      ...TIDY_EVENTS,
      carpenter_returned: true, // 跳过 farm 木匠回归自动演出
    },
  },
});

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
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const flags = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('return_star_save') || 'null');
  return s ? (s.mapFlags || {}) : {};
});
const bodyText = () => page.evaluate(() => document.body.innerText);

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

const gotoScene = async (saveObj, scene) => {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), saveObj);
  await page.reload({ waitUntil: 'networkidle2' });
  await enterGame(scene);
  await sleep(1000);
};

const pressE = async () => {
  await page.keyboard.press('KeyE');
  await sleep(500);
};

/** 推进对白直到出现 watchStrs 或超时 */
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

try {
  // ============ A: house 翻柜子入口 ============
  console.log('--- A house 翻柜子入口（老屋整理完成后）---');
  await gotoScene(makeSave('house', CABINET_POS.x, CABINET_POS.y + 20), 'house');

  // A1: 柜子位置出现"？"标记
  const hasMark = await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    return !!s.xiyaOldShadowMark;
  });
  result('A1 柜子位置出现"？"标记（setupXiyaOldShadow）', hasMark, '');

  // A2: 靠近按 E → 入口对白
  await pressE();
  const a2 = await advanceUntilSeen(['也许夏雅认识']);
  result('A2 入口对白出现', a2.allSeen, JSON.stringify(a2.seen));

  // A3: 推进到对白结束，验证 asked 入档
  const aT0 = Date.now();
  while (Date.now() - aT0 < 8000 && (await flags()).sideXiyaOldShadowAsked !== true) {
    await page.keyboard.press('Enter');
    await page.mouse.click(400, 300);
    await sleep(300);
  }
  const aFlags = await flags();
  result('A3 入口入档（sideXiyaOldShadowAsked=true）', aFlags.sideXiyaOldShadowAsked === true, JSON.stringify(aFlags));

  // A4: 标记已消失（翻过后销毁）
  const markGone = await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    return !s.xiyaOldShadowMark;
  });
  result('A4 翻柜子后标记消失', markGone, '');

  // ============ B: farm 老屋门口交付 ============
  console.log('\n--- B farm 老屋门口交付（§八对白）---');
  await gotoScene(makeSave('farm', OLD_HOUSE_POS.x, OLD_HOUSE_POS.y, {
    restore: { oldHouse: true },
    mapFlags: { sideXiyaOldShadowAsked: true },
  }), 'farm');

  await pressE();
  const b1 = await advanceUntilSeen(['有一天它们可能会派上用场']);
  result('B1 §八交付对白出现', b1.allSeen, JSON.stringify(b1.seen));

  // B2: 推进到对白结束，验证 done 入档
  const bT0 = Date.now();
  while (Date.now() - bT0 < 8000 && (await flags()).sideXiyaOldShadowDone !== true) {
    await page.keyboard.press('Enter');
    await page.mouse.click(400, 300);
    await sleep(300);
  }
  const bFlags = await flags();
  result('B2 完成入档（sideXiyaOldShadowDone=true）', bFlags.sideXiyaOldShadowDone === true, JSON.stringify(bFlags));

  // ============ C: 读档恢复（全完成后不重复触发）============
  console.log('\n--- C 读档恢复（全完成后重进，事件不再触发）---');
  // C1: house 重进 → 无柜子标记
  await gotoScene(makeSave('house', CABINET_POS.x, CABINET_POS.y + 20, {
    mapFlags: { sideXiyaOldShadowAsked: true, sideXiyaOldShadowDone: true },
  }), 'house');
  const c1Mark = await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    return !!s.xiyaOldShadowMark;
  });
  result('C1 house 全完成后无柜子标记', !c1Mark, '');

  // C2: farm 重进 → 不触发交付对白
  await gotoScene(makeSave('farm', OLD_HOUSE_POS.x, OLD_HOUSE_POS.y, {
    restore: { oldHouse: true },
    mapFlags: { sideXiyaOldShadowAsked: true, sideXiyaOldShadowDone: true },
  }), 'farm');
  await pressE();
  await sleep(800);
  const cBody = await bodyText();
  result('C2 farm 全完成后不再触发交付对白', !cBody.includes('有一天它们可能会派上用场'), '');

  // ============ D: 无运行时错误 ============
  result('D1 无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-ch1-xiya-old-shadow 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
