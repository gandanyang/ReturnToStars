/**
 * 花田支线：帮小梅开垦花田（2026-08-11 制作人拍板）—— 运行时验证探针
 *
 * 验证：
 *   1. 入口对白：farm 左上角花田 (3,7) 靠近按 E → 入口（asked）→ 木材不足提示
 *   2. 木材×3 交付：保留 asked + 木材足够 → 再次靠近 → 完成（done + 花田盛开 + 记忆卡）
 *   3. 读档恢复：完成后重进不再触发
 *   4. 全程无运行时错误
 *
 * 前置：dev server；node probe-gardener-field.mjs
 */

import puppeteer from 'puppeteer-core';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
const FIELD_POS = { x: 3 * T + T / 2, y: 7 * T + T / 2 }; // farm 左上角花田锚点

const makeSave = (scene, x, y, opts = {}) => ({
  version: '0.5', savedAt: 'gardener-field-probe', timestamp: Date.now(),
  player: {
    x, y, scene, facing: 'down',
    inventory: { wood: opts.wood ?? 0, copper: opts.copper ?? 0 },
  },
  world: {
    day: 1, hour: opts.hour ?? 12, minute: 0, coins: 100, level: 1, xp: 0,
    stamina: 100, minedOres: [], questState: opts.questState ?? 'not_started',
  },
  farm: { tiles: [], crops: [], trees: [], restore: opts.restore ?? {} },
  story: { storyStep: opts.storyStep ?? 'done' },
  mapFlags: opts.mapFlags,
  gameState: { triggeredEvents: { carpenter_returned: true } },
});

async function run() {
  console.log('=== 花田支线：帮小梅开垦花田 运行时验证 ===\n');
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

  const flags = () => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('return_star_save') || 'null');
    return s ? (s.mapFlags || {}) : {};
  });
  const savedWood = () => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('return_star_save') || 'null');
    return s && s.player && s.player.inventory ? (s.player.inventory.wood || 0) : -1;
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
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
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

  // ============ A：入口对白 + 木材不足 ============
  console.log('--- A 入口对白（花田 (3,7)，无木材）---');
  await gotoScene(makeSave('farm', FIELD_POS.x, FIELD_POS.y, { wood: 0 }), 'farm');
  await pressE();
  let a1 = await advanceUntilSeen(['弄来几根木材']);
  check('A1 入口对白出现', a1.allSeen, JSON.stringify(a1.seen));
  check('A2 入口入档（asked）', (await flags()).sideGardenerFieldAsked === true, JSON.stringify(await flags()));

  await pressE();
  let a3 = await advanceUntilSeen(['还差几根木材']);
  check('A3 木材不足提示出现', a3.allSeen, JSON.stringify(a3.seen));
  check('A4 木材不足不扣木', (await savedWood()) === 0, `wood=${await savedWood()}`);

  // ============ B：木材×3 交付完成 ============
  console.log('\n--- B 木材×3 交付（保留 asked + 木材足够）---');
  await gotoScene(makeSave('farm', FIELD_POS.x, FIELD_POS.y, {
    wood: 5,
    mapFlags: { sideGardenerFieldAsked: true },
  }), 'farm');
  await pressE();
  let b1 = await advanceUntilSeen(['撒下花种', '开出']);
  check('B1 完成对白出现', b1.allSeen, JSON.stringify(b1.seen));
  const bT0 = Date.now();
  while (Date.now() - bT0 < 8000 && (await flags()).sideGardenerFieldDone !== true) {
    await page.keyboard.press('Enter');
    await page.mouse.click(400, 300);
    await sleep(300);
  }
  check('B2 扣木材 5→2', (await savedWood()) === 2, `wood=${await savedWood()}`);
  check('B3 完成入档（done）', (await flags()).sideGardenerFieldDone === true, JSON.stringify(await flags()));

  // ============ C：读档恢复 ============
  console.log('\n--- C 读档恢复（done 后重进，事件不再触发）---');
  await gotoScene(makeSave('farm', FIELD_POS.x, FIELD_POS.y, {
    wood: 5,
    mapFlags: { sideGardenerFieldAsked: true, sideGardenerFieldDone: true },
  }), 'farm');
  await pressE();
  await sleep(800);
  const cBody = await bodyText();
  check('C1 已完成后不再触发花田对白', !cBody.includes('弄来几根木材'), '');

  // ============ D：运行时错误 ============
  check('D1 无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('探针异常：', e);
  process.exit(1);
});
