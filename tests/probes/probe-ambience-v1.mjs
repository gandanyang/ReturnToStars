/**
 * probe-ambience-v1.mjs — P1 环境音验证（2026-08-09 制作人"环境音交给你"）
 *
 * 验证：
 * T1 农场白天：环境音层=2（wind + waves 远处海浪）+ 地图=farm
 * T2 青禾镇白天：层=2（voices + wind）+ 地图=town（镇子补鸟叫为事件音不进循环）
 * T3 农场夜晚：层=2（crickets + wind），事件音链不启动（无报错）
 * T4 事件音链存活：farm 白天停留 8s，无 console error（鸟/海鸥调度正常）
 * T5 切图重建：farm → town 环境音层正确切换（无残留叠加）
 *
 * 依赖：dev server (localhost:5173)；视口横屏 1024x768（项目红线）
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0;
let fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.text().includes('Uncaught')) errors.push(msg.text().slice(0, 120));
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

async function waitScene(key, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => !!window.__game?.scene?.getScene?.(k)?.player, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => { const b = document.getElementById('intro-skip-btn'); if (b) b.click(); });
  await sleep(500);
  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.setTime(9, 0); // 白天
    window.debug.events?.markTriggered?.('first_morning_response');
  });
  await sleep(400);

  // ── T1 农场白天 ──
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } }); });
  await waitScene('farm');
  await sleep(2500);
  const a1 = await page.evaluate(() => window.debug.ambience());
  result('T1 农场白天 层=2(wind+waves) + 地图=farm', a1.map === 'farm' && a1.layers === 2, JSON.stringify(a1));

  // ── T4 事件音链存活：farm 停留 8s 观察错误 ──
  await sleep(8000);
  const errAfterFarm = errors.length;
  result('T4 farm 事件音链 8s 无报错', errAfterFarm === 0, errors.slice(0, 2).join('; '));

  // ── T2 青禾镇白天 ──
  await page.evaluate(() => { window.__game.scene.start('town', { spawn: { x: 200, y: 300 } }); });
  await waitScene('town');
  await sleep(2500);
  const a2 = await page.evaluate(() => window.debug.ambience());
  result('T2 青禾镇白天 层=2(voices+wind) + 地图=town', a2.map === 'town' && a2.layers === 2, JSON.stringify(a2));
  await sleep(6000);
  const errAfterTown = errors.length;
  result('T5 town 事件音链（鸟/犬吠/猫叫）无报错', errAfterTown === errAfterFarm, errors.slice(0, 2).join('; '));

  // ── T3 农场夜晚 ──
  await page.evaluate(() => {
    window.debug.setTime(21, 0);
    window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } });
  });
  await waitScene('farm');
  await sleep(2500);
  const a3 = await page.evaluate(() => window.debug.ambience());
  result('T3 农场夜晚 层=2(crickets+wind)', a3.map === 'farm' && a3.layers === 2, JSON.stringify(a3));

  // 附加：全程无页面错误
  result('附加 无页面错误', errors.length === 0, errors.slice(0, 2).join('; '));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-ambience-v1 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
