import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.text().includes('[DEBUG] tryInteract NPC') || m.type() === 'error') console.log(m.text()); });

await page.goto(BASE + '?reset=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(1500);
await page.goto(BASE + '?devHub=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(2000);
await page.waitForFunction(() => { const s = window.__game?.scene?.getScene?.('title'); return !!s && s.scene.isActive(); }, { timeout: 10000 });
await sleep(500);
await page.keyboard.press('Enter');
await sleep(2000);

// 跳「集市恢复前」→ town（15:00 左右）
await page.evaluate(() => { const s = window.__game.scene.getScene('station'); s.player.x = 400; s.player.y = 430; });
await sleep(300);
await page.keyboard.press('KeyE');
await sleep(800);
await page.evaluate(() => {
  const items = [...document.querySelectorAll('div')];
  const t = items.find(el => el.textContent.includes('集市恢复前') && el.style.cursor === 'pointer');
  if (t) t.click();
});
await sleep(3500);

// 读取所有 NPC 位置 + 玩家位置
const info = await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  return {
    player: { x: Math.round(s.player.x), y: Math.round(s.player.y) },
    npcs: s.npcList.map(n => ({ id: n.id, x: Math.round(n.sprite?.x ?? 0), y: Math.round(n.sprite?.y ?? 0), vis: n.sprite?.visible })),
    time: window.debug.getTimeStr?.(),
  };
});
console.log('INFO', JSON.stringify(info, null, 1));
await browser.close();
process.exit(0);
