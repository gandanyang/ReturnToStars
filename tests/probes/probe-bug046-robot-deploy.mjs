// BUG-046 验证：机器人部署在已开垦(tilled)土地
import puppeteer from 'puppeteer-core';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
const result = (step, passed, detail = '') => {
  console.log(`${passed ? '✅' : '❌'} ${step}: ${passed ? '通过' : '失败'}${detail ? ' - ' + detail : ''}`);
  results.push(passed);
};
const dialText = () => page.evaluate(() => document.body.innerText);

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('  [err]', m.text().substring(0, 120)); });

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
  window.debug.giveItem?.('auto_farmer_robot', 1);
});
await sleep(600);
await page.evaluate(() => {
  const s = window.__game.scene.getScenes(true)[0];
  if (s?.scene?.key !== 'farm') s.scene.start('farm', { spawn: { x: 200, y: 300 } });
});
await sleep(4000);

const robotCount = () => page.evaluate(() => {
  const s = window.__game.scene.getScene('farm');
  return s?.robotVisuals?.size ?? -1;
});

async function deployAt(col, row, state) {
  await page.evaluate(([c, r, st]) => {
    window.debug.farm.setTileState(c, r, st);
    const s = window.__game.scene.getScene('farm');
    // deployRobot 用玩家脚下格子（Math.floor(player.y/16)）→ 玩家站目标格上
    s.player.x = c * 16 + 8; s.player.y = r * 16 + 8; s.player.facing = 'up';
    // 关闭任何挡屏对白
    try { s.storyDialogue?.close?.(); s.storyDialogue?.reset?.(); } catch {}
  }, [col, row, state]);
  await sleep(500);
  await page.evaluate(() => {
    try {
      window.__game.scene.getScene('farm').deployRobot();
    } catch (e) { console.log('[err] deployRobot:', e.message); }
  });
  await sleep(1000);
}

// T1 tilled 部署成功
const c0 = await robotCount();
await deployAt(13, 8, 'tilled');
const c1 = await robotCount();
const t1 = await dialText();
result('T1 已开垦土地可部署机器人', c1 === c0 + 1, `robot ${c0}→${c1}, text含已部署=${t1.includes('已部署')}`);

// T2 planted 拒绝
const c2 = await robotCount();
await deployAt(15, 8, 'planted');
const c3 = await robotCount();
const t2 = await dialText();
result('T2 有作物的格子拒绝部署', c3 === c2, `robot ${c2}→${c3}, text含种了东西=${t2.includes('种了东西')}`);

// T3 empty 回归
await page.evaluate(() => window.debug.giveItem?.('auto_farmer_robot', 1));
const c4 = await robotCount();
await deployAt(16, 8, 'empty');
const c5 = await robotCount();
const t3 = await dialText();
result('T3 空地部署回归', c5 === c4 + 1, `robot ${c4}→${c5}, text含已部署=${t3.includes('已部署')}`);

const pass = results.filter(Boolean).length;
console.log(`\n========== BUG-046 结果: ✅ ${pass} 通过 / ❌ ${results.length - pass} 失败 ==========`);
await browser.close();
