/**
 * _phase2-region-shots.mjs — 施工辅助（非探针）：镇子美术完善区域特写截图（制作人目测）
 * S5 农田(木埂/作物) S8 果林(树阵) S6 河堤(岸草/树) S4 院内(荒草/瓦砾) S1 镇牌 S2 空招牌
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOT = 'tests/probes/test-screenshots/phase2b';

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const save = {
  version: '0.5', savedAt: 'phase2b', timestamp: Date.now(),
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

let n = 0;
async function shot(cx, cy, zoom, label) {
  n++;
  // 相机 centerOn 构图：停止跟随，把舞台块中心对准画面中心（setBounds 会钳制在 800×560 内）
  await page.evaluate(([x, y, z]) => {
    const s = window.__game?.scene?.getScene?.('town');
    if (!s) throw new Error('town 未就绪');
    const cam = s.cameras.main;
    cam.setZoom(z);
    cam.stopFollow();
    cam.centerOn(x, y);
    s.player.facing = 'down';
  }, [cx, cy, zoom]);
  await sleep(900);
  await page.screenshot({ path: `${SHOT}/${String(n).padStart(2, '0')}-${label}.png` });
  console.log(`shot ${label} center=(${cx},${cy}) zoom=${zoom}`);
}

const T = 16;
await shot(45 * T, 21 * T, 2, 's5-farm-ridges');   // S5 农田：木埂 + 零散作物
await shot(45 * T, 9 * T, 2, 's8-orchard-trees');  // S8 果林：树阵
await shot(3 * T, 18 * T, 2, 's6-riverbank');      // S6 河堤：岸线草丛补密 + 稀疏树
await shot(25 * T, 31 * T, 2, 's4-yard-weeds');    // S4 旧宅：院内荒草 + 门口瓦砾
await shot(37 * T + 8, 6 * T, 4, 's2-empty-sign'); // S2 老街：空招牌+破摊架特写（z4 聚焦，中心下移避开地图外夜空）
await shot(25 * T, 17 * T, 2, 's3-plaza');         // S3 广场：镇中生活区全景

console.log('errors:', errors.length === 0 ? '0' : errors.slice(0, 3).join(' | '));
await browser.close();
