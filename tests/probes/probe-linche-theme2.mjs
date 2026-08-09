/**
 * probe-linche-theme2.mjs — 林澈个人曲 2《The Road I Choose》验证（2026-08-09）
 *
 * 验证：
 * T1 老屋（house）→ BGM=linche_theme2（主角私域/情绪基地）
 * T2 农场白天不受影响 → BGM=farm_day
 * T3 无 [MusicSystem] 加载失败（linche_theme2.ogg 可加载）
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

const warns = [];
page.on('console', (msg) => {
  if (msg.text().includes('[MusicSystem] 加载失败')) warns.push(msg.text());
});
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));

async function waitScene(key, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => !!window.__game?.scene?.getScene?.(k)?.player, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}
async function waitMusic(expect, timeout = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const cur = await page.evaluate(() => window.debug.musicCurrent?.() ?? null);
    if (cur === expect) return cur;
    await sleep(250);
  }
  return await page.evaluate(() => window.debug.musicCurrent?.() ?? null);
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
    window.debug.setTime(9, 0);
    window.debug.events?.markTriggered?.('first_morning_response');
  });
  await sleep(400);

  // ── T1 老屋 → linche_theme2 ──
  await page.evaluate(() => { window.__game.scene.start('house', { spawn: { x: 5 * 16, y: 8 * 16 } }); });
  await waitScene('house');
  const cur1 = await waitMusic('linche_theme2');
  result('T1 老屋 BGM=linche_theme2', cur1 === 'linche_theme2', cur1);

  // ── T2 农场白天不受影响 ──
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } }); });
  await waitScene('farm');
  const cur2 = await waitMusic('farm_day');
  result('T2 农场白天 BGM=farm_day（不受影响）', cur2 === 'farm_day', cur2);

  // ── T3 无加载失败 ──
  result('T3 无音乐加载失败', warns.length === 0, warns.slice(0, 2).join('; '));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-linche-theme2 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
