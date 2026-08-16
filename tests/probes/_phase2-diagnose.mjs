/**
 * _phase2-diagnose.mjs — 施工辅助（非探针）：最小诊断——确认 town 场景加载 + 新叙事物件无报错
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const save = {
  version: '0.5', savedAt: 'phase2-diagnose', timestamp: Date.now(),
  player: { x: 208, y: 296, scene: 'town', facing: 'down', inventory: {} },
  world: { day: 1, hour: 12, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' },
};

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(800);
await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(2200);
await page.keyboard.press('Enter');
await sleep(600);
let townReady = false;
for (let i = 0; i < 30; i++) {
  await sleep(400);
  townReady = await page.evaluate(() => {
    const g = window.__game;
    return !!(g && g.scene && g.scene.getScene('town'));
  });
  if (townReady) break;
}
await sleep(1000);
// 跳过开场对白
for (let i = 0; i < 20; i++) {
  const open = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    return !!(s?.storyDialogue && s.storyDialogue.isOpen && s.storyDialogue.isOpen());
  });
  if (!open) break;
  await page.keyboard.press('KeyE');
  await sleep(300);
}
await sleep(800);

const info = await page.evaluate(() => {
  const s = window.__game?.scene?.getScene?.('town');
  const tex = window.__game?.textures?.get('tiles');
  return {
    scene: s?.scene?.key,
    hasPlayer: !!s?.player,
    player: s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null,
    decor: s?.townLife?.decor,
    texW: tex?.getSourceImage?.()?.width ?? -1,
  };
});
console.log('info:', JSON.stringify(info));
console.log('errors:', errors.length === 0 ? '0' : errors.join('\n'));
await browser.close();
