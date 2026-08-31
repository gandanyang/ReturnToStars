/**
 * probe-music-cross-scene.mjs — 音乐盒"我的歌"跨地图连续验证
 *
 * 验证（2026-08-10 制作人需求"换地图音乐不切"）：
 *   1. 音乐盒选曲（我的歌）→ 播放指定曲
 *   2. 切换地图（farm → town）→ 音乐不中断（同 key 幂等连续，不重播）
 *   3. 未选我的歌时 → 换地图音乐随场景默认切换（原行为保留）
 *
 * 前置：dev server + window.debug.musicCurrent / setMusicBoxTrack 钩子
 * 视口：横屏 1024x768（项目红线）
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
let pass = 0, fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

async function waitScene(key, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!s && !!s.player;
    }, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}
async function musicCurrent() {
  return page.evaluate(() => window.debug.musicCurrent?.() ?? null);
}
async function waitMusic(expect, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const cur = await musicCurrent();
    if (cur === expect) return cur;
    await sleep(200);
  }
  return musicCurrent();
}
async function setMusicBoxTrack(k) {
  await page.evaluate((key) => {
    window.debug.setMusicBoxTrack(key);
  }, k);
  await sleep(300);
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  // 探针环境前置（2026-08-30）：显式开声，消除静音默认探针债（同 probe-sfx-performance 范式）
  await page.evaluate(() => localStorage.setItem('return_star_sound_on', '1'));
  await sleep(2500);
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => {
    const b = document.getElementById('intro-skip-btn');
    if (b) b.click();
  });
  await sleep(500);
  // 跳到游玩状态（白天气候 + 教程完成），对齐 probe-music-v1 初始化
  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.setTime(15, 0);
    window.debug.events?.markTriggered?.('first_morning_response');
  });
  await sleep(400);

  // ── A1 进入 farm，白天默认 BGM=farm_day ──
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } }); });
  const a1ok = await waitScene('farm');
  const cur1 = a1ok ? await waitMusic('farm_day') : null;
  result('A1 进入 farm 白天默认 BGM=farm_day', a1ok && cur1 === 'farm_day', `scene=${a1ok} music=${cur1}`);

  // ── A2 音乐盒选"我的歌"=town → 播放切到 town ──
  await setMusicBoxTrack('town');
  const cur2 = await waitMusic('town');
  result('A2 音乐盒选曲后播放我的歌 town', cur2 === 'town', `cur=${cur2}`);

  // ── A3 切到 town 场景 → 目标仍为"我的歌"=town → 幂等连续（仍 town）──
  await page.evaluate(() => { window.__game.scene.start('town', { spawn: { x: 200, y: 300 } }); });
  await waitScene('town');
  await sleep(1200);
  const cur3 = await musicCurrent();
  result('A3 切到 town 后音乐仍为我的歌 town（连续）', cur3 === 'town', `cur=${cur3}`);

  // ── A4 切回 farm → 同样连续 ──
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } }); });
  await waitScene('farm');
  await sleep(1200);
  const cur4 = await musicCurrent();
  result('A4 切回 farm 后音乐仍为我的歌 town（连续）', cur4 === 'town', `cur=${cur4}`);

  // ── A5 停止"我的歌" → 重启 farm → 恢复地图默认 farm_day ──
  await setMusicBoxTrack(null);
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } }); });
  await waitScene('farm');
  const cur5 = await waitMusic('farm_day');
  result('A5 停止我的歌后恢复 farm 默认 farm_day', cur5 === 'farm_day', `cur=${cur5}`);

  // ── A6 未选我的歌切 town → 默认随场景切换为 town ──
  await page.evaluate(() => { window.__game.scene.start('town', { spawn: { x: 200, y: 300 } }); });
  await waitScene('town');
  const cur6 = await waitMusic('town');
  result('A6 未选歌切 town：默认随场景切换为 town', cur6 === 'town', `cur=${cur6}`);

  const realErrors = errors.filter((e) => !e.includes('favicon') && !e.startsWith('console: Failed to load resource'));
  result('B1 无运行时错误', realErrors.length === 0, realErrors.join(' | ').slice(0, 200) || '');
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-music-cross-scene 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
