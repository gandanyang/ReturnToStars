/**
 * probe-linche-theme.mjs — 林澈个人曲归档验证（2026-08-09）
 *
 * 验证：
 * T1 day2 清晨醒来演出 → BGM=linche_theme（主角独处时刻起播）
 * T2 2.6s 后夏雅对白开始 → BGM=farm_day（世界的声音回来，恢复场景音乐）
 * T3 无 [MusicSystem] 加载失败（linche_theme.ogg 可加载播放）
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

const musicWarns = [];
page.on('console', (msg) => {
  if (msg.text().includes('[MusicSystem] 加载失败')) musicWarns.push(msg.text());
});
page.on('pageerror', (e) => musicWarns.push('pageerror: ' + e.message));

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => { const b = document.getElementById('intro-skip-btn'); if (b) b.click(); });
  await sleep(500);
  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.nextDay(); // day 1 → 2
    window.debug.setTime(8, 0);
    window.debug.events?.markTriggered?.('adventurer_welcome_back');
    window.debug.events?.markTriggered?.('carpenter_returned');
  });
  await sleep(400);
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } }); });
  // 轮询等 farm 就绪
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const ok = await page.evaluate(() => !!window.__game?.scene?.getScene?.('farm')?.player);
    if (ok) break;
    await sleep(300);
  }
  await sleep(1500);

  // 触发清晨演出（运行时可达；trySleep/create 挂钩同逻辑）
  const triggered = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    const before = s.firstMorningDone;
    s.tryFirstMorningSequence();
    return { before, after: s.firstMorningDone };
  });
  await sleep(800);
  const cur1 = await page.evaluate(() => window.debug.musicCurrent());
  result('T1 day2清晨醒来 BGM=linche_theme', triggered.after && cur1 === 'linche_theme', `trig=${triggered.after} music=${cur1}`);

  // 等 2.6s delayedCall 夏雅对白开始 → 恢复 farm_day
  await sleep(3000);
  const cur2 = await page.evaluate(() => window.debug.musicCurrent());
  result('T2 夏雅对白开始 BGM=farm_day', cur2 === 'farm_day', cur2);

  result('T3 无音乐加载失败', musicWarns.length === 0, musicWarns.slice(0, 2).join('; '));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-linche-theme 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
