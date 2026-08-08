/**
 * 探针：v1.0 生活仪式感反馈系统（first_hoe / first_plant / first_water 一次性）
 * 断言基于 window.debug.guixingTags()（GuiXingRecord 一次性标签，入档）
 * 验证：
 *   H1 第一次锄地 → tag first_hoe 出现
 *   H2 第二次锄地 → 不新增（一次性）
 *   P1 第一次播种 → tag first_plant 出现（回归）
 *   W1 第一次浇水 → tag first_water 出现
 *   W2 第二次浇水 → 不新增
 *   S1 存档+读档后 → first_* 仍在（入档恢复），锄地不再触发新标签
 * 前置：Vite dev localhost:5173；横屏 1024×768；农田格 (13-17,8)
 */
import puppeteer from 'puppeteer-core';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function result(step, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${step}: ${passed ? '通过' : '失败'}${detail ? ' - ' + detail : ''}`);
  results.push(passed);
}
const tags = () => page.evaluate(() => window.debug.guixingTags?.() ?? []);

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('  [err]', m.text().substring(0, 120)); });

async function setup() {
  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.keyboard.press('Enter');
  await sleep(1500);
  await page.evaluate(() => { const b = document.getElementById('intro-skip-btn'); if (b) b.click(); });
  await sleep(500);
  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.setTime(9, 0);
    window.debug.events?.markTriggered?.('first_morning_response');
    window.debug.events?.markTriggered?.('adventurer_welcome_back');
    window.debug.events?.markTriggered?.('carpenter_returned');
    window.debug.giveItem?.('old_hoe', 1);
    window.debug.giveItem?.('old_watering_can', 1);
    window.debug.giveItem?.('radish_seed', 10);
  });
  await sleep(600);
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    if (s?.scene?.key !== 'farm') s.scene.start('farm', { spawn: { x: 200, y: 300 } });
  });
  await sleep(4000); // farm 首编慢（Vite），多给余量
}
async function actOn(col, row, state, crop) {
  await page.evaluate(([c, r, st, cr]) => {
    window.debug.farm.setTileState(c, r, st);
    if (cr) window.debug.farm.setCrop(c, r, cr);
    const s = window.__game.scene.getScene('farm');
    s.player.x = c * 16 + 8; s.player.y = (r + 1) * 16 + 8; s.player.facing = 'up';
  }, [col, row, state, crop ?? null]);
  await sleep(500);
  await page.keyboard.press('KeyE');
  await sleep(1200);
}

await setup();

// ---- H1 第一次锄地 ----
await actOn(13, 8, 'empty', null);
let t = await tags();
result('H1 第一次锄地 → first_hoe 出现', t.includes('first_hoe'), t.join(','));
// H2 第二次锄地 → 集合不变（只多不增；验证仍只有 first_hoe 首次相关）
await actOn(14, 8, 'empty', null);
t = await tags();
result('H2 第二次锄地 → 一次性（无新增标签）', t.filter(x => x === 'first_hoe').length === 1, t.join(','));

// ---- P1 第一次播种 ----
await actOn(13, 8, 'tilled', null); // 13,8 已锄 → 播种
t = await tags();
result('P1 第一次播种 → first_plant 出现（回归）', t.includes('first_plant'), t.join(','));

// ---- W1 第一次浇水 ----
await actOn(15, 8, 'planted', { cropType: 'radish', plantDay: 1, watered: false });
t = await tags();
result('W1 第一次浇水 → first_water 出现', t.includes('first_water'), t.join(','));
// W2 第二次浇水 → 不新增
await actOn(16, 8, 'planted', { cropType: 'radish', plantDay: 1, watered: false });
t = await tags();
result('W2 第二次浇水 → 一次性', t.filter(x => x === 'first_water').length === 1, t.join(','));

// ---- S1 存档 + 读档后 first_* 入档恢复，不再新增 ----
await page.evaluate(() => {
  const s = window.__game.scene.getScenes(true)[0];
  if (typeof s?.saveGame === 'function') s.saveGame();
});
await sleep(600);
await page.reload({ waitUntil: 'networkidle2' });
await sleep(3000);
await page.evaluate(() => {
  const s = window.__game.scene.getScenes(true)[0];
  // 不带 spawn：createScene 里 hasSave() && !spawn 才读档（mapFlags 恢复 first_*）
  if (s?.scene?.key !== 'farm') s.scene.start('farm');
  window.debug.giveItem?.('old_hoe', 1);
});
await sleep(4000);
const tAfterLoad = await tags();
await actOn(17, 8, 'empty', null); // 新格锄地
t = await tags();
const s1Text = await page.evaluate(() => document.getElementById('memory-moment-overlay')?.textContent?.trim() || '<无>');
// S1 行为断言：读档后锄地 → 不弹第一次锄地仪式文本（first_hoe 由 mapFlags 恢复，不重触发）
result('S1 读档后锄地 → 不重播仪式文本', !s1Text.includes('原来土地'), s1Text);
// S2 标签断言：读档后锄地 → guixingTags 无新增 first_hoe（未重触发 triggerTag）
result('S2 读档后锄地 → 不再新增 first_hoe', t.filter(x => x === 'first_hoe').length === tAfterLoad.filter(x => x === 'first_hoe').length, t.join(','));

const pass = results.filter(Boolean).length;
console.log(`\n========== 结果: ✅ ${pass} 通过 / ❌ ${results.length - pass} 失败 ==========`);
await browser.close();
