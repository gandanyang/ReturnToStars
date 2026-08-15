import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
// 清晨 7 点进 farm → 夏雅在 (33,4) 浇水
const save = {
  version: '0.5', savedAt: 'xiya-check', timestamp: Date.now(),
  player: { x: 300, y: 200, scene: 'farm', facing: 'down', inventory: {} },
  world: { day: 2, hour: 7, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
  chapter: 1, worldRestore: {}, gameState: { triggeredEvents: {} },
};
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(1200);
await page.evaluate(() => localStorage.removeItem('return_star_save'));
await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(2500);
await page.keyboard.press('Enter');
await sleep(1500);
for (let i = 0; i < 20; i++) {
  const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
  if (sc === 'farm') break;
  await sleep(300);
}
await sleep(1500);
// 相机移到夏雅位置 (33,4)
await page.evaluate(() => {
  const s = window.__game.scene.getScene('farm');
  s.player.x = 33 * 16; s.player.y = 4 * 16;
  s.cameras.main.startFollow(s.player, true, 0.5, 0.5, 0, 0);
});
await sleep(1200);
const info = await page.evaluate(() => {
  const s = window.__game.scene.getScene('farm');
  return {
    dawnXiya: s.dawnXiya ? { x: s.dawnXiya.x, y: s.dawnXiya.y, scale: s.dawnXiya.scaleX } : null,
  };
});
console.log('XIYA', JSON.stringify(info));
await page.screenshot({ path: 'G:/ReturnToStars/tests/probes/test-screenshots/xiya-prog.png' });
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
process.exit(0);
