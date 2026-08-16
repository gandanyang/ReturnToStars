/**
 * _diag-hint-residue.mjs — 诊断：各种"按 E 查看/交互"提示是否在远离后残留
 * 遍历交互点：靠近 → 记录 DOM hint → 远离 → 检查 hint 是否消失
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function seedSave(scene, x, y, extra = {}) {
  return {
    version: '0.5', savedAt: 'diag', timestamp: Date.now(),
    player: { x, y, scene, facing: 'down', inventory: {} },
    world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'in_progress', ch1TownIntroDone: true },
    chapter: 1, worldRestore: {},
    gameState: { triggeredEvents: {} },
    ...extra,
  };
}

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

async function boot(scene, x, y) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1200);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), seedSave(scene, x, y));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(1000);
  for (let i = 0; i < 30; i++) {
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === scene) break;
    await sleep(250);
  }
  await sleep(1200);
}

/** 列出当前所有可见 hint 文本 */
async function listHints(label) {
  const hints = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    return divs
      .filter((d) => d.style.position === 'fixed' && /按 \[E\]|点击「交互」/.test(d.textContent || ''))
      .map((d) => (d.textContent || '').trim())
      .filter((t) => t.length > 0);
  });
  console.log(`[${label}] hints =`, JSON.stringify(hints));
  return hints;
}

async function moveTo(x, y) {
  await page.evaluate(([xx, yy]) => {
    const s = window.__game.scene.getScenes(true)[0];
    s.player.x = xx; s.player.y = yy;
  }, [x, y]);
  await sleep(400);
}

async function getInteractTargets() {
  return await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    const out = {};
    if (s.gatherNodes) {
      out.gather = s.gatherNodes.filter((n) => !n.collected).map((n) => ({ x: n.def.x, y: n.def.y, kind: n.def.kind }));
    }
    if (s.qinghePierRestore) out.pier = { x: s.qinghePierRestore.pos.x, y: s.qinghePierRestore.pos.y, restored: s.qinghePierRestore.restored };
    if (s.qinghePavilion) out.pavilion = { x: s.qinghePavilion.pos.x, y: s.qinghePavilion.pos.y };
    if (s.fishingSpot) out.fishing = { x: s.fishingSpot.x, y: s.fishingSpot.y };
    return out;
  });
}

try {
  // ═══ 测试 1：青禾河畔 码头/凉亭/采集 ═══
  console.log('════ 青禾河畔 ════');
  await boot('qinghe_river', 5 * 16 + 8, 19 * 16 + 8);
  const targets1 = await getInteractTargets();
  console.log('targets:', JSON.stringify(targets1, null, 1));

  // 采集点
  if (targets1.gather && targets1.gather[0]) {
    const g = targets1.gather[0];
    await moveTo(g.x + 3, g.y + 3);
    await listHints('靠近采集');
    await moveTo(g.x + 80, g.y + 80); // 远离
    await listHints('远离采集');
  }
  // 码头
  if (targets1.pier) {
    await moveTo(targets1.pier.x + 3, targets1.pier.y + 3);
    await listHints('靠近码头');
    await moveTo(targets1.pier.x + 60, targets1.pier.y + 60);
    await listHints('远离码头');
  }
  // 凉亭
  if (targets1.pavilion) {
    await moveTo(targets1.pavilion.x + 3, targets1.pavilion.y + 3);
    await listHints('靠近凉亭');
    await moveTo(targets1.pavilion.x + 60, targets1.pavilion.y + 60);
    await listHints('远离凉亭');
  }
  await page.screenshot({ path: 'C:/Users/Gdy/AppData/Local/Temp/opencode/hint-qinghe.png' });

  // ═══ 测试 2：town 钓鱼点 ═══
  console.log('════ town 钓鱼 ════');
  await boot('town', 400, 300);
  const targets2 = await getInteractTargets();
  if (targets2.fishing) {
    await moveTo(targets2.fishing.x + 3, targets2.fishing.y + 3);
    await listHints('靠近钓点');
    await moveTo(targets2.fishing.x + 60, targets2.fishing.y + 60);
    await listHints('远离钓点');
  }

  console.log('ERRORS', JSON.stringify(errors));
} finally {
  await browser.close();
}
process.exit(0);
