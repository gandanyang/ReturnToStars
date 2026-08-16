/**
 * _diag-hint-all.mjs — 全面诊断 hint 残留（v2）
 * 测：靠近出现 / 远离消失 / 交互触发后消失 / 对话打开时消失
 * 修：move 前等待场景就绪
 */
import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function seed(scene, x, y, extra = {}) {
  return { version: '0.5', savedAt: 'diag', timestamp: Date.now(),
    player: { x, y, scene, facing: 'down', inventory: {} },
    world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] }, story: { storyStep: 'done', ch1TownIntroDone: true },
    chapter: 1, worldRestore: {}, gameState: { triggeredEvents: {} }, ...extra };
}

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

async function boot(scene, x, y, extra) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1200);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), seed(scene, x, y, extra));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(1000);
  for (let i = 0; i < 40; i++) {
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === scene) break;
    await sleep(250);
  }
  await sleep(1200);
  await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.(); });
  await sleep(300);
}
async function hints() {
  return await page.evaluate(() => Array.from(document.querySelectorAll('div'))
    .filter((d) => d.style.position === 'fixed' && /按 \[E\]|点击「交互」/.test(d.textContent || ''))
    .map((d) => (d.textContent || '').trim()).filter((t) => t.length > 0));
}
async function setTime(day, h, m) { await page.evaluate(([d, hh, mm]) => window.debug.setTimeFull(d, hh, mm), [day, h, m]); await sleep(300); }
async function move(x, y) {
  const ok = await page.evaluate(([xx, yy]) => {
    const s = window.__game?.scene?.getScenes?.(true)?.[0];
    if (!s) return false;
    s.player.x = xx; s.player.y = yy; return true;
  }, [x, y]);
  await sleep(350);
  return ok;
}
async function interact() { await page.evaluate(() => { const s = window.__game?.scene?.getScenes(true)[0]; if (s?.tryInteract) s.tryInteract(); }); await sleep(500); }
let pass = 0, fail = 0;
function check(name, ok, detail = '') { console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`); ok ? pass++ : fail++; }

try {
  // ═══ town 钓鱼：靠近→触发→消失 / 对话打开→消失 ═══
  console.log('════ town 钓鱼触发 ════');
  await boot('town', 400, 300);
  const spot = await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; return s.fishingSpotPos ? { x: s.fishingSpotPos.x, y: s.fishingSpotPos.y } : null; });
  if (spot) {
    await move(spot.x + 3, spot.y + 3);
    check('钓点 靠近出现', (await hints()).some((t) => t.includes('钓鱼')));
    // 触发钓鱼（casting）
    await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; if (s.tryFishingInteract) s.tryFishingInteract(); });
    await sleep(300);
    const hCasting = await hints();
    check('钓鱼中(casting) 无靠近提示', !hCasting.some((t) => t.includes('钓鱼')), JSON.stringify(hCasting));
    // 停止钓鱼回 idle
    await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; s.endFishing?.(); });
    await sleep(300);
  }

  // ═══ town 老姜 ═══
  console.log('════ town 老姜 ════');
  await setTime(1, 15, 0);
  const lj = await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; return s.laoJiangPos ? { x: s.laoJiangPos.x, y: s.laoJiangPos.y } : null; });
  if (lj) {
    await move(lj.x + 2, lj.y + 2);
    const hNear = await hints();
    check('老姜 靠近出现', hNear.some((t) => t.includes('老姜')), JSON.stringify(hNear));
    // 触发对话 → 应消失
    await interact();
    const hAfter = await hints();
    check('老姜 对话后消失', hAfter.length === 0, JSON.stringify(hAfter));
    // 关闭对话
    await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.(); });
    await sleep(300);
  }

  // ═══ house 老屋整理 ═══
  console.log('════ house 老屋整理 ════');
  await boot('house', 160, 192);
  const tidy = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    const arr = (s.tidyNodes || s.houseTidyNodes || []).map((n) => ({ x: n.x ?? n.pos?.x, y: n.y ?? n.pos?.y, done: n.done }));
    return arr;
  });
  console.log('tidy nodes:', JSON.stringify(tidy));

  console.log(`\n===== 诊断结果: ${pass} 通过 / ${fail} 失败 =====`);
  console.log('ERRORS', JSON.stringify(errors));
} finally { await browser.close(); }
process.exit(fail > 0 ? 1 : 0);
