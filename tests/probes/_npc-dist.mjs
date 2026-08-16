/**
 * 测量 town/farm 场景 NPC 触发距离——排查"没看到小梅却对话"
 */
import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const save = (scene) => ({
  version: '0.5', savedAt: 'npc-test', timestamp: Date.now(),
  player: { x: 360, y: 400, scene, facing: 'down', inventory: {} },
  world: { day: 1, hour: 15, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' }, chapter: 1,
  gameState: { triggeredEvents: { first_morning_response: true } },
});

async function enter(scene) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1600);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save(scene));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === scene) break;
  }
  await sleep(1200);
  // 跳对话
  for (let i = 0; i < 15; i++) {
    const open = await page.evaluate(() => !!window.__game?.scene?.getScene?.(scene)?.storyDialogue?.isOpen?.());
    if (!open) break;
    await page.keyboard.press('KeyE'); await sleep(250);
  }
  await sleep(500);
}

async function measure(scene, label) {
  await enter(scene);
  const data = await page.evaluate((sc) => {
    const s = window.__game.scene.getScene(sc);
    if (!s?.npcList) return { error: 'no npcList' };
    return s.npcList.map((n) => ({
      id: n.id,
      x: Math.round(n.sprite?.x ?? 0), y: Math.round(n.sprite?.y ?? 0),
      visible: n.sprite?.visible ?? false,
      active: s.scene.isActive(),
    }));
  }, scene);
  console.log(`[${label}]`, JSON.stringify(data));
}

await measure('town', 'town 15:00');
await measure('farm', 'farm 15:00');
await browser.close();
process.exit(0);
