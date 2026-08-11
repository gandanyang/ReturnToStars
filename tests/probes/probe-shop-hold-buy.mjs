/**
 * 探针 — 商店批量购买浮层 + 长按连买（方案 D，2026-08-11）
 *
 * 验证目标（Level 2）：
 *  1. 单击购买按钮 → 弹出批量浮层（不直接买）
 *  2. 浮层选 ×1 确认 → 买 1 个
 *  3. 浮层选 ×5 确认 → 买 5 个
 *  4. 浮层选最大确认 → 买光金币
 *  5. 浮层取消 → 不买
 *  6. 长按购买按钮 → 连买（400ms 后每 120ms 一次，直到没钱）
 *  7. 金币不足时浮层档位置灰 / 长按自动停
 *  8. 出售按钮长按不会连卖
 *  9. 无 JS 错误
 *
 * 前置：dev server（localhost:5175 或 GAME_URL 指定）
 * 运行：node tests/probes/probe-shop-hold-buy.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5175/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' - ' + extra : ''}`);
  ok ? pass++ : fail++;
}

const waitFor = async (fn, timeout = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(250);
  }
  return null;
};

async function writeSeed(page) {
  await page.evaluate(() => {
    localStorage.setItem('return_star_save', JSON.stringify({
      version: '0.5',
      savedAt: 'shop bulk-buy probe',
      timestamp: Date.now(),
      player: {
        x: 96, y: 160, scene: 'farm', facing: 'down',
        inventory: { radish: 5 },
      },
      world: {
        day: 1, hour: 9, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [],
        questState: 'not_started', dailyQuest: null,
      },
      farm: { tiles: [], crops: [], trees: [] },
      story: { storyStep: 'done', ch1TownIntroDone: false },
    }));
  });
}

async function enterFarm(page) {
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => { const b = document.getElementById('intro-skip-btn'); if (b) b.click(); });
  await sleep(500);
  await page.evaluate(() => {
    window.debug?.setStoryStep?.('done');
    window.debug?.setTime?.(9, 0);
    window.__game.scene.start('farm', { spawn: { x: 96, y: 160 } });
  });
  await sleep(3000);
}

async function openShop(page) {
  return page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    s?.shopPanel?.open();
    return !!document.getElementById('shop-panel');
  });
}

async function shopCoins(page) {
  return page.evaluate(() => {
    const el = document.querySelector('#shop-panel #shop-coins');
    if (!el) return -1;
    const m = el.textContent.match(/\d+/);
    return m ? parseInt(m[0], 10) : -1;
  });
}

async function btnCenter(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
}

/** 单击购买按钮，等浮层出现 */
async function clickBuyAndOpenBulk(page, action) {
  const pt = await btnCenter(page, `#shop-panel [data-action="${action}"]`);
  if (!pt) return false;
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
  await sleep(300);
  return await page.evaluate(() => {
    const o = document.getElementById('shop-bulk-overlay');
    return o && o.style.display !== 'none';
  });
}

/** 点击浮层内某个 [data-bulk-qty] 或 [data-bulk-action] */
async function clickBulkBtn(page, selector) {
  const pt = await btnCenter(page, `#shop-bulk-overlay ${selector}`);
  if (!pt) return false;
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.click(pt.x, pt.y);
  await sleep(300);
  return true;
}

async function run() {
  console.log('=== 探针：商店批量购买浮层 + 长按连买（方案 D）===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await writeSeed(page);
    await enterFarm(page);
    const scene = await page.evaluate(() => window.__game.scene.getScenes(true)[0]?.scene?.key ?? 'none');
    check('进入农场场景', scene === 'farm', `scene=${scene}`);
    const opened = await waitFor(() => openShop(page));
    check('0. 商店面板已打开', opened === true);

    // ---------- A. 出售按钮长按：只卖 1 个 ----------
    let coins = await shopCoins(page);
    check('A0. 初始金币 100', coins === 100, `coins=${coins}`);
    const sellBtn = await btnCenter(page, '#shop-panel [data-action="sell-radish"]');
    await page.mouse.move(sellBtn.x, sellBtn.y);
    await page.mouse.down();
    await sleep(800);
    await page.mouse.up();
    await sleep(400);
    coins = await shopCoins(page);
    check('A1. 长按出售只卖 1 个（100 → 115，不连卖）', coins === 115, `coins=${coins}`);

    // ---------- B. 单击购买 → 弹浮层 ----------
    const bulkShown = await clickBuyAndOpenBulk(page, 'buy-radish-seed');
    check('B1. 单击购买弹出批量浮层', bulkShown === true, `shown=${bulkShown}`);

    // ---------- C. 浮层选 ×1 确认 → 买 1 个 ----------
    await clickBulkBtn(page, '[data-bulk-qty="1"]');
    await clickBulkBtn(page, '[data-bulk-action="confirm"]');
    await sleep(300);
    coins = await shopCoins(page);
    check('C1. 浮层 ×1 确认买 1 个（115 → 105）', coins === 105, `coins=${coins}`);

    // ---------- D. 浮层选 ×5 确认 → 买 5 个 ----------
    await clickBuyAndOpenBulk(page, 'buy-radish-seed');
    await clickBulkBtn(page, '[data-bulk-qty="5"]');
    await clickBulkBtn(page, '[data-bulk-action="confirm"]');
    await sleep(300);
    coins = await shopCoins(page);
    check('D1. 浮层 ×5 确认买 5 个（105 → 55）', coins === 55, `coins=${coins}`);

    // ---------- E. 浮层取消 → 不买 ----------
    await clickBuyAndOpenBulk(page, 'buy-radish-seed');
    await clickBulkBtn(page, '[data-bulk-action="cancel"]');
    await sleep(300);
    coins = await shopCoins(page);
    check('E1. 浮层取消不买（仍 55）', coins === 55, `coins=${coins}`);

    // ---------- F. 浮层选最大 → 买光 ----------
    await clickBuyAndOpenBulk(page, 'buy-radish-seed');
    // 最大档位按钮（第4个 data-bulk-qty）
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#shop-bulk-overlay [data-bulk-qty]');
      const maxBtn = btns[btns.length - 1];
      if (maxBtn) maxBtn.click();
    });
    await sleep(200);
    await clickBulkBtn(page, '[data-bulk-action="confirm"]');
    await sleep(300);
    coins = await shopCoins(page);
    check('F1. 浮层最大买光（55 → 5，买 5 个）', coins === 5, `coins=${coins}`);

    // ---------- G. 金币不足时浮层仍可弹（档位置灰）----------
    // 剩 5G，萝卜种子 10G，买不起 → 单击应弹"资金不足"toast 而非浮层
    const poorShown = await clickBuyAndOpenBulk(page, 'buy-radish-seed');
    check('G1. 金币不足不弹浮层', poorShown === false, `shown=${poorShown}`);

    // ---------- H. 长按连买 ----------
    // 先卖萝卜回血：卖 4 个萝卜（4×15=60）→ 65G
    for (let i = 0; i < 4; i++) {
      const spt = await btnCenter(page, '#shop-panel [data-action="sell-radish"]');
      await page.mouse.move(spt.x, spt.y);
      await page.mouse.click(spt.x, spt.y);
      await sleep(150);
    }
    await sleep(300);
    coins = await shopCoins(page);
    check('H0. 卖 4 萝卜回血（5 → 65）', coins === 65, `coins=${coins}`);

    // 长按 1.5s：400ms 后首次购买，然后每 120ms 一次
    // 65G / 10G = 6 次 → 5G
    const holdBtn = await btnCenter(page, '#shop-panel [data-action="buy-radish-seed"]');
    await page.mouse.move(holdBtn.x, holdBtn.y);
    await page.mouse.down();
    await sleep(1500);
    await page.mouse.up();
    await sleep(400);
    coins = await shopCoins(page);
    check('H1. 长按连买直到没钱（65 → 5）', coins === 5, `coins=${coins}`);
    check('H2. 未透支成负数', coins >= 0, `coins=${coins}`);

    // ---------- I. 无 JS 错误 ----------
    check('I1. 无页面 JS 错误', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

    console.log(`\n========== 结果: ✅ ${pass} 通过 / ❌ ${fail} 失败 ==========`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch(err => { console.error('探针异常:', err); process.exit(1); });
