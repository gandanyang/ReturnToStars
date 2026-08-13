/**
 * probe-phase2-narrative-shots.mjs — Phase 2 叙事物件验收截图（制作人验收法）
 *
 * 验收标准（制作人 2026-08-13 拍板）：
 *   "如果一个完全没玩过《归星物语》的人看到这张地图，
 *    他能不能猜出来这里发生过什么？"
 *   不能只是"这里有好多房子、树和装饰"。
 *
 * 流程：玩家从 farm→town 出生点 → 依次走到
 *   S1 镇门遗址（第一眼）→ S4 老屋宅基地 → S2 老街 → S7 集市
 * 每点截图，供制作人目测"地图会不会自己讲故事"。
 * 不做美化断言，只出图 + 记录物件数量。
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOT = 'tests/probes/test-screenshots/phase2';

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const save = {
  version: '0.5', savedAt: 'phase2', timestamp: Date.now(),
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
// 等待 town 场景真正就绪（__game.scene.getScene('town') 存在）
let townReady = false;
for (let i = 0; i < 30; i++) {
  await sleep(400);
  townReady = await page.evaluate(() => {
    const g = window.__game;
    return !!(g && g.scene && g.scene.getScene('town'));
  });
  if (townReady) break;
}
if (!townReady) { console.log('❌ town 场景未就绪'); process.exit(1); }
// 等玩家生成
for (let i = 0; i < 10; i++) {
  await sleep(300);
  const hasPlayer = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    return !!(s && s.player);
  });
  if (hasPlayer) break;
}
await sleep(1200);
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

let shotN = 0;
async function gotoAndShot(x, y, facing, label) {
  shotN++;
  await page.evaluate(([px, py, f]) => {
    const s = window.__game?.scene?.getScene?.('town');
    if (s?.player) { s.player.setPosition(px, py); s.player.facing = f; }
    else throw new Error('town/player 未就绪');
  }, [x, y, facing]);
  await sleep(900);
  await page.screenshot({ path: `${SHOT}/${String(shotN).padStart(2, '0')}-${label}.png` });
  console.log(`📸 ${label} (${x},${y}) facing=${facing}`);
}

// S1 镇门遗址：出生点看北（第一眼：镇牌/倒木栏/坏路灯 + 前方宅基地残墙）
await gotoAndShot(208, 296, 'up', 's1-gate-first-glance');
// 靠近镇门看
await gotoAndShot(400, 470, 'up', 's1-gate-close');
// S4 老屋宅基地：门口看院内（残墙/废井/荒草）
await gotoAndShot(400, 500, 'down', 's4-home-ruin');
// S2 老街：老街屋 + 空招牌 + 石阶
await gotoAndShot(560, 130, 'down', 's2-old-street');
// S7 集市：旧摊痕迹
await gotoAndShot(300, 100, 'down', 's7-market-ruin');

// 物件统计（供记录）
const stats = await page.evaluate(async () => {
  const res = await fetch('assets/maps/town.json');
  const m = await res.json();
  const W = m.width;
  const w = m.layers[1].data;
  return {
    wall: w.filter(v => v === 10).length,
    roof: w.filter(v => v === 9).length,
    window: w.filter(v => v === 12).length,
    door: w.filter(v => v === 11).length,
    well: w.filter(v => v === 13).length,
    fence: w.filter(v => v === 14).length,
    weed: w.filter(v => v === 8).length,
  };
});
console.log('叙事物件统计:', JSON.stringify(stats));
console.log('页面错误:', errors.length === 0 ? '0 条 ✅' : errors.slice(0, 3).join(' | '));

await browser.close();
