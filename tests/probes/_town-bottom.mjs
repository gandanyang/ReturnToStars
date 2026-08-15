import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const save = {
  version: '0.5', savedAt: 'town-bottom', timestamp: Date.now(),
  player: { x: 96, y: 336, scene: 'town', facing: 'down', inventory: {} },
  world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
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
  if (sc === 'town') break;
  await sleep(300);
}
await sleep(1500);
// 下方西侧草地 (col 6, row 21)
await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  s.player.x = 6 * 16 + 8; s.player.y = 21 * 16 + 8;
  s.cameras.main.startFollow(s.player, true, 0.5, 0.5, 0, 0);
});
await sleep(1200);
await page.screenshot({ path: 'G:/ReturnToStars/tests/probes/test-screenshots/town-bottom-west.png' });
// 南端草地 (col 7, row 31)
await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  s.player.x = 7 * 16 + 8; s.player.y = 31 * 16 + 8;
  s.cameras.main.startFollow(s.player, true, 0.5, 0.5, 0, 0);
});
await sleep(1200);
await page.screenshot({ path: 'G:/ReturnToStars/tests/probes/test-screenshots/town-bottom-south.png' });
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
process.exit(0);
