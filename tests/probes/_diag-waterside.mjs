/**
 * _diag-waterside.mjs — 忠实复现"水边按E钓鱼 → 走开变按E查看（残留）"
 * 富状态：启用 artShow 全链 + 第一章，town 与 qinghe_river 水边走动，监控 hint + 面板
 */
import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function seed(scene, x, y, extra = {}) {
  const events = [
    'ch1_awakening','ch1_house_tidy_done','ch1_elder_visit','ch1_market_cleared',
    'ch1_market_stall_1','ch1_market_stall_2','ch1_market_stall_3','ch1_spring_fair',
    'artshow_xiya_plan','artshow_elder_coord','artshow_carpenter_photo','artshow_gardener_flower',
  ];
  return { version: '0.5', savedAt: 'diag', timestamp: Date.now(),
    player: { x, y, scene, facing: 'down', inventory: {} },
    world: { day: 3, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] }, story: { storyStep: 'done', ch1TownIntroDone: true },
    chapter: 1, worldRestore: { marketSquare: true },
    gameState: { triggeredEvents: Object.fromEntries(events.map((e) => [e, true])) },
    mapFlags: { artShowUnlocked: true, artShowEnvStage: 3, artShowMaterialsDone: true },
    ...extra };
}

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

async function boot(scene, x, y) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1200);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), seed(scene, x, y));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(1000);
  for (let i = 0; i < 40; i++) {
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === scene) break;
    await sleep(250);
  }
  await sleep(1500);
  await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.(); });
  await sleep(300);
}
/** 列出所有 visible 的 hint + 面板文本 */
async function visibles() {
  return await page.evaluate(() => {
    const out = { hints: [], panels: [] };
    for (const d of Array.from(document.querySelectorAll('div'))) {
      const st = d.style;
      const visible = !st.display || st.display !== 'none';
      if (!visible) continue;
      const t = (d.textContent || '').trim();
      if (!t) continue;
      if (st.position === 'fixed' && /按 \[E\]/.test(t)) out.hints.push(t);
    }
    const dq = document.getElementById('daily-quest-panel');
    if (dq && dq.style.display !== 'none') out.panels.push('daily-quest-panel visible');
    return out;
  });
}
async function setTime(h, m) { await page.evaluate(([hh, mm]) => window.debug.setTime(hh, mm), [h, m]); await sleep(250); }
async function move(x, y) {
  await page.evaluate(([xx, yy]) => { const s = window.__game?.scene?.getScenes?.(true)?.[0]; if (s) { s.player.x = xx; s.player.y = yy; } }, [x, y]);
  await sleep(350);
}
let pass = 0, fail = 0;
function check(name, ok, detail = '') { console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`); ok ? pass++ : fail++; }

try {
  // ═══ town 水边 ═══
  console.log('════ town 水边（钓点 88,200）════');
  await boot('town', 400, 300);
  const t = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return { spot: s.fishingSpotPos ? { x: s.fishingSpotPos.x, y: s.fishingSpotPos.y } : null,
      artshowBox: s.artShowBox ? { x: s.artShowBox.x, y: s.artShowBox.y } : null,
      artshowUnlocked: !!s.artShowUnlocked };
  });
  console.log('town:', JSON.stringify(t));
  if (t.spot) {
    await move(t.spot.x + 3, t.spot.y + 3);
    console.log('  在水边:', JSON.stringify((await visibles()).hints));
    // 走开（远离钓点 + 远离所有交互）
    await move(t.spot.x + 90, t.spot.y + 90);
    console.log('  走开90:', JSON.stringify((await visibles()).hints));
    await move(500, 500);
    console.log('  角落500,500:', JSON.stringify((await visibles()).hints));
  }

  // ═══ qinghe_river 水边 ═══
  console.log('════ qinghe_river 水边 ════');
  await boot('qinghe_river', 100, 300);
  const q = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return { spot: s.fishingSpotPos ? { x: s.fishingSpotPos.x, y: s.fishingSpotPos.y } : null,
      pier: s.qinghePierRestore ? { x: s.qinghePierRestore.pos.x, y: s.qinghePierRestore.pos.y } : null,
      pav: s.qinghePavilion ? { x: s.qinghePavilion.pos.x, y: s.qinghePavilion.pos.y } : null };
  });
  console.log('qinghe:', JSON.stringify(q));
  if (q.spot) {
    await move(q.spot.x + 3, q.spot.y + 3);
    console.log('  在水边:', JSON.stringify((await visibles()).hints));
    await move(q.spot.x + 90, q.spot.y + 90);
    console.log('  走开90:', JSON.stringify((await visibles()).hints));
  }

  console.log(`\n===== 诊断结果: ${pass} / ${fail} =====`);
  console.log('ERRORS', JSON.stringify(errors));
} finally { await browser.close(); }
process.exit(0);
