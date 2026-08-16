import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
const save = {
  version: '0.5', savedAt: 'tex-check', timestamp: Date.now(),
  player: { x: 300, y: 200, scene: 'farm', facing: 'down', inventory: {} },
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
  if (sc === 'farm') break;
  await sleep(300);
}
await sleep(1500);
const info = await page.evaluate(() => {
  const s = window.__game.scene.getScene('farm');
  const tex = s.textures.get('player');
  const src = tex.getSourceImage();
  // 帧数量（纹理切分信息）
  let frameCount = null;
  try { frameCount = Object.keys(tex.frames || {}).length; } catch {}
  const frame = s.player ? s.player.frame : null;
  return {
    texWidth: src ? src.width : 'none',
    texHeight: src ? src.height : 'none',
    frameCount,
    currentFrame: frame ? { name: frame.name, w: frame.width, h: frame.height } : null,
    playerScale: s.player ? { x: s.player.scaleX, y: s.player.scaleY } : null,
    bodySize: s.player && s.player.body ? { w: s.player.body.width, h: s.player.body.height } : null,
    bodyOffset: s.player && s.player.body ? { x: s.player.body.offset.x, y: s.player.body.offset.y } : null,
  };
});
console.log('TEX', JSON.stringify(info, null, 1));
await browser.close();
process.exit(0);
