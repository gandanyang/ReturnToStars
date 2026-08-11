/**
 * 探针：自动售货机出售功能 防回归验证（2026-08-11 制作人拍板：老板下班也能卖货）
 *
 * 背景：ShopPanel machine 模式原本隐藏出售栏（subtitle 也写「出售请白天找老板」），
 * 老板不在场（夜间/家）时无法卖作物矿石，体验麻烦。修改后 machine 模式保留出售栏。
 *
 * 断言：
 *   A1 machine 模式出售栏可见（display != none）且标题=自动售货机、特殊商店栏隐藏
 *   A2 单卖萝卜：金币增加、萝卜数量 -1
 *   A3 全部出售按钮可用（有可售物品时 opacity=1）
 *
 * 前置：Vite dev server 跑在 localhost:5173
 * 运行：node tests/probes/probe-shop-machine-sell.mjs
 */
import puppeteer from 'puppeteer-core';

const GAME_URL = 'http://localhost:5173/';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
function result(step, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${step}: ${passed ? '通过' : '失败'}${detail ? ' - ' + detail : ''}`);
  results.push(passed);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== 自动售货机出售功能 防回归探针 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`  [err] ${msg.text().substring(0, 140)}`);
    });

    // ---------- 准备：清档 → 主线完成 → 给 3 萝卜 + 2 石头 → 进 farm → 打开售货机 ----------
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
    await page.evaluate(() => {
      window.debug.setStoryStep('done');
      window.debug.setQuestState('completed');
      window.debug.giveItem('radish', 3);
      window.debug.giveItem('stone', 2);
    });
    await page.evaluate(() => {
      const g = window.__game;
      const active = g.scene.getScenes(true)[0];
      if (active && active.scene.key !== 'farm') g.scene.stop(active.scene.key);
      g.scene.start('farm', { spawn: { x: 480, y: 300 } });
    });
    await sleep(1500);
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      s.shopPanel.open('machine');
    });
    await sleep(700);

    // ---------- A1 出售栏可见 + 标题/特殊栏状态 ----------
    const a1 = await page.evaluate(() => {
      const sellCol = document.querySelector('#shop-sell-col');
      const specialCol = document.querySelector('#shop-special-col');
      const title = document.querySelector('#shop-title')?.textContent ?? '';
      const sellBtn = document.querySelector('#shop-sell [data-action="sell-radish"]');
      return {
        sellColDisplay: sellCol ? sellCol.style.display : 'missing',
        specialColDisplay: specialCol ? specialCol.style.display : 'missing',
        title,
        hasSellRadish: !!sellBtn,
      };
    });
    result('A1 售货机出售栏可见',
      a1.sellColDisplay !== 'none' && a1.sellColDisplay !== 'missing' && a1.hasSellRadish &&
        a1.specialColDisplay === 'none' && a1.title === '自动售货机',
      `出售栏=${a1.sellColDisplay} 特殊栏=${a1.specialColDisplay} 标题="${a1.title}"`);

    // ---------- A2 单卖萝卜：金币增加 + 萝卜 -1 ----------
    const parseCoins = t => parseInt((t ?? '').replace(/\D/g, ''), 10) || 0;
    const readState = () => page.evaluate(() => {
      const coins = document.querySelector('#shop-coins')?.textContent ?? '';
      const radishRow = document.querySelector('#shop-sell [data-action="sell-radish"]')?.closest('div');
      const radishText = radishRow?.textContent ?? '';
      const m = radishText.match(/×(\d+)/);
      return { coins: parseInt(coins.replace(/\D/g, ''), 10) || 0, radish: m ? parseInt(m[1], 10) : -1 };
    });
    const before = await readState();
    // 直接派发 click（避免坐标命中问题）
    await page.evaluate(() => {
      const btn = document.querySelector('#shop-sell [data-action="sell-radish"]');
      if (btn) btn.click();
    });
    await sleep(700);
    const after = await readState();
    result('A2 售货机单卖萝卜金币增加',
      after.coins > before.coins && after.radish === before.radish - 1,
      `金币 ${before.coins} → ${after.coins} | 萝卜 ${before.radish} → ${after.radish}`);

    // ---------- A3 全部出售按钮可用（仍有可售物品 → opacity=1） ----------
    const a3 = await page.evaluate(() => {
      const btn = document.querySelector('[data-action="sell-all"]');
      return btn ? { opacity: btn.style.opacity, cursor: btn.style.cursor } : null;
    });
    result('A3 全部出售按钮可用', !!a3 && a3.opacity === '1', JSON.stringify(a3));

    // ---------- A4 关闭面板无异常（Esc 或 close） ----------
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      s.shopPanel.close();
    });
    await sleep(300);
    const closed = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return !s.shopPanel.isOpen();
    });
    result('A4 面板正常关闭', closed, '');

    const pass = results.filter(Boolean).length;
    const fail = results.length - pass;
    console.log(`\n========== 结果: ✅ ${pass} / ❌ ${fail} ==========`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('探针异常:', err);
  process.exit(1);
});
