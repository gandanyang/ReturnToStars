// P0-03 商店实机截图（v2：屏蔽一次性演出 + 截图前强制关闭浮层）
import puppeteer from 'puppeteer-core';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const OUT = join(__dirname, 'test-screenshots', 'store');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('  [err]', m.text().substring(0, 140)); });

const shot = async (name) => {
  await page.evaluate(() => {
    // 强制关闭所有浮层（StoryDialogue / memoryMoment DOM），保证截图无对话框
    const s = window.__game?.scene?.getScenes?.(true)?.[0];
    try { s?.storyDialogue?.close?.(); } catch {}
    try { s?.storyDialogue?.reset?.(); } catch {}
    // 隐藏 memoryMoment（飘字）
    document.querySelectorAll('[id*="memory"], [class*="memory-moment"]').forEach(el => {
      el.style.display = 'none'; el.style.opacity = '0';
    });
    // 隐藏剧情回顾 panel
    document.getElementById('dialogue-history')?.remove?.();
  });
  await sleep(200);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`📸 ${name}`);
};

const goto = async (key, spawn) => {
  await page.evaluate(([k, sp]) => {
    const s = window.__game.scene.getScenes(true)[0];
    if (s?.scene?.key !== k) s.scene.start(k, { spawn: sp });
  }, [key, spawn]);
  await sleep(2500);
};

await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
await sleep(2500);
await page.keyboard.press('Enter');
await sleep(1500);
await page.evaluate(() => { const b = document.getElementById('intro-skip-btn'); if (b) b.click(); });
await sleep(500);

// 一次性演出全部标记（避免它们在截图场景中弹对白/飘字污染画面）
await page.evaluate(() => {
  window.debug.setStoryStep('done');
  window.debug.nextDay();
  window.debug.setQuestState('completed');
  window.debug.setTime(9, 0);
  // 屏蔽一次性演出
  window.debug.events?.markTriggered?.('first_morning_response');
  window.debug.events?.markTriggered?.('adventurer_welcome_back');
  window.debug.events?.markTriggered?.('carpenter_returned');
  window.debug.events?.markTriggered?.('elder_starter_gift');
  // 标记夏雅/阿风等也跳过（防 ch1TownIntroDone=true 后触发）
  window.debug.markCh1TownIntroDone?.();
});
await sleep(800);

// 1) 农田收获
await goto('farm', { x: 250, y: 300 });
await page.evaluate(() => {
  window.debug.farm.setTileState(13, 8, 'grown');
  window.debug.farm.setCrop(13, 8, { cropType: 'radish', plantDay: 1, watered: true });
  window.debug.farm.setTileState(14, 8, 'grown');
  window.debug.farm.setCrop(14, 8, { cropType: 'radish', plantDay: 1, watered: true });
  window.debug.farm.setTileState(15, 8, 'grown');
  window.debug.farm.setCrop(15, 8, { cropType: 'radish', plantDay: 1, watered: true });
  const s = window.__game.scene.getScene('farm');
  s.player.x = 12 * 16 + 8; s.player.y = 10 * 16 + 8; s.player.facing = 'up';
});
await sleep(1500);
await shot('s2-farm-harvest');

// 2) 老屋生活感
await goto('house', { x: 160, y: 200 });
await page.evaluate(() => {
  const s = window.__game.scene.getScene('house');
  s.player.x = 9 * 16 + 8; s.player.y = 6 * 16 + 8; s.player.facing = 'up';
});
await sleep(1500);
await shot('s6-house');

// 3) 青禾镇
await goto('town', { x: 380, y: 428 });
await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  s.player.x = 14 * 16 + 8; s.player.y = 9 * 16 + 8; s.player.facing = 'up';
});
await sleep(1500);
await shot('s5-town');

// 4) 后山古树+碎片
await goto('forest', { x: 200, y: 300 });
await page.evaluate(() => {
  const s = window.__game.scene.getScene('forest');
  s.player.x = 8 * 16 + 8; s.player.y = 9 * 16 + 8; s.player.facing = 'up';
});
await sleep(1500);
await shot('s4-forest');

// 5) 观星夜（先清掉本节可能残留的清晨飘字，再走观星）
await goto('farm', { x: 480, y: 300 });
await page.evaluate(() => { window.debug.setTime(21, 0); });
await sleep(400);
await page.evaluate(() => {
  const s = window.__game.scene.getScene('farm');
  s.player.x = 504; s.player.y = 240; s.player.facing = 'up';
});
await sleep(400);
await page.keyboard.press('KeyE');
await sleep(10000);
await shot('s1-stargaze');

await browser.close();
console.log('done');