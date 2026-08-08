/**
 * P0 防黑屏（2026-08-09）：WebGL context lost 兜底验证。
 * 验证 main.ts setupContextLostGuard：
 *  A1 正常运行无遮罩
 *  A2 派发 webglcontextlost → 3s 后 #gl-lost-overlay 出现且文案正确
 *  A3 派发 webglcontextrestored → 遮罩消失（恢复窗口）
 *  A4 再次 lost → 遮罩重现（可重复触发）
 * 前置: Vite dev server localhost:5173；桌面 1024×768 横屏。
 */
import puppeteer from 'puppeteer-core';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function ok(step, passed, detail = '') {
  if (passed) { pass++; console.log(`  ✅ ${step}${detail ? ' - ' + detail : ''}`); }
  else { fail++; console.log(`  ❌ ${step}${detail ? ' - ' + detail : ''}`); }
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
    await page.keyboard.press('Enter');
    await sleep(2000);
    await page.evaluate(() => {
      document.getElementById('intro-skip-btn')?.click();
      window.debug.setStoryStep('done');
    });
    await sleep(800);
    // 走进农场（车站出口）
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      if (s?.player) { s.player.x = 970; s.player.y = 460; }
    });
    await sleep(3000);

    // A1 正常运行无遮罩
    const a1 = await page.evaluate(() => !!document.getElementById('gl-lost-overlay'));
    ok('A1 正常运行无遮罩', a1 === false, `overlay=${a1}`);

    // A2 派发 contextlost → 3s 后遮罩出现
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      c.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await sleep(1000);
    const a2early = await page.evaluate(() => !!document.getElementById('gl-lost-overlay'));
    ok('A2a 1s 内（3s 窗口内）未显示', a2early === false, `overlay=${a2early}`);
    await sleep(3200); // 累计 4.2s > 3s
    const a2 = await page.evaluate(() => {
      const el = document.getElementById('gl-lost-overlay');
      return {
        shown: !!el,
        text: el?.textContent?.includes('图形渲染遇到问题') ?? false,
        hasBtn: !!el?.querySelector('button'),
        z: el?.style?.zIndex,
      };
    });
    ok('A2 超时后遮罩出现', a2.shown && a2.text && a2.hasBtn,
      `shown=${a2.shown} text=${a2.text} btn=${a2.hasBtn} z=${a2.z}`);
    await page.screenshot({ path: join(__dirname, 'test-screenshots', 'gl-contextlost-overlay.png') });

    // A3 派发 restored → 遮罩消失
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      c.dispatchEvent(new Event('webglcontextrestored'));
    });
    await sleep(500);
    const a3 = await page.evaluate(() => !!document.getElementById('gl-lost-overlay'));
    ok('A3 contextrestored 遮罩消失', a3 === false, `overlay=${a3}`);

    // A4 再次 lost → 遮罩重现（可重复触发）
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      c.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await sleep(4200);
    const a4 = await page.evaluate(() => !!document.getElementById('gl-lost-overlay'));
    ok('A4 再次 lost 遮罩重现', a4 === true, `overlay=${a4}`);

    // 游戏循环仍存活（遮罩只是引导层，不破坏游戏）
    const alive = await page.evaluate(() => window.__game?.loop?.running === true);
    ok('A5 游戏循环存活', alive === true, `loop=${alive}`);

    console.log(`\n===== 结果: ✅ ${pass} 通过 / ❌ ${fail} 失败 =====`);
    if (errors.length) {
      console.log('pageerror:');
      errors.forEach(e => console.log('  ' + e.split('\n')[0]));
    }
    await sleep(1000);
  } catch (e) {
    console.error('\n❌ 异常:', e.message);
  } finally {
    await browser.close();
  }
}

run();
