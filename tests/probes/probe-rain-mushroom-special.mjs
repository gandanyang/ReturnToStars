/**
 * probe-rain-mushroom-special.mjs — P0 语义修复验收：rain_forest 由真实天气决定（2026-08-16）
 *
 * 制作人拍板：特殊发现条件从 `day % 5 === 0`（假定雨后）改为**当前真实天气**——
 * 玩家看到下雨（WeatherSystem Day2 10:00-16:00 雨窗）→ 森林采蘑菇 → 记录 rain_forest；
 * 非雨天采蘑菇 → 普通发现，不记录特殊。
 *
 * 验证：
 *   R1 非雨天（Day2 09:00 雨窗前）森林采蘑菇 → 无 rain_forest
 *   R2 雨天（Day2 12:00 雨窗内）森林采蘑菇 → rain_forest 被记录
 *   R3 debug.nature.weather 与雨幕同源（isCurrentlyRaining）
 *   R4 无运行时错误
 *
 * 运行：node tests/probes/probe-rain-mushroom-special.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

async function seedDay2() {
  const save = {
    version: '0.5', savedAt: 'rain-mushroom', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 2, hour: 7, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1, worldRestore: { oldHouse: true },
    gameState: { triggeredEvents: { ch1_awakening: true, ch1_elder_visit: true } },
  };
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
}

async function enterGame(scene, timeoutMs = 25000) {
  const t0 = Date.now();
  let cur = '';
  while (Date.now() - t0 < timeoutMs) {
    cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === scene) return;
    if (cur === 'title') {
      await page.keyboard.press('Enter');
      await page.mouse.click(400, 300);
    }
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find((d) => d.textContent?.includes('建议打开声音游玩'));
      if (el) { el.click(); return true; }
      return false;
    });
    await sleep(350);
  }
  const save = await page.evaluate(() => localStorage.getItem('return_star_save')?.slice(0, 120) ?? '<none>');
  throw new Error(`未能进入场景 ${scene}（实际 ${cur}）save=${save}`);
}

async function skipDialogue(maxMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const open = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return !!(s?.storyDialogue && s.storyDialogue.isOpen && s.storyDialogue.isOpen());
    });
    if (!open) return;
    await page.keyboard.press('Enter');
    await sleep(350);
  }
}

/** 走真实出口进森林 */
async function exitToForest() {
  // farm 场景有多个延迟自动对白（阿风欢迎/木匠回归/小梅雨天提示等），
  // 必须确认"对白已全部关掉且短时间内无新对白"再传送，否则出口检测被对话挡住。
  await skipDialogue(8000);
  await sleep(1000);
  await skipDialogue(3000);
  await page.evaluate(async () => {
    const g = window.__game;
    const cur = g.scene.getScenes(true)[0];
    if (!cur?.player) throw new Error(`当前场景无 player（scene=${cur?.scene?.key ?? 'none'}）`);
    const exits = (await import('/src/data/exits.ts')).MAP_EXITS;
    const zone = (exits[cur.scene.key] ?? []).find((e) => e.target === 'forest');
    if (!zone) throw new Error(`场景 ${cur.scene.key} 无通向 forest 出口`);
    cur.player.x = zone.x + zone.w / 2;
    cur.player.y = zone.y + zone.h / 2;
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === 'forest') { await sleep(1500); return; }
    await sleep(300);
  }
  throw new Error('未进入 forest');
}

/** 采一个未采蘑菇节点，返回 { ok, special, discovery } */
async function gatherMushroom() {
  for (let attempt = 0; attempt < 4; attempt++) {
    await skipDialogue(3000);
    const r = await page.evaluate(async () => {
      const s = window.__game.scene.getScene('forest');
      if (s.storyDialogue?.isOpen?.()) return { blocked: 'dialogue' };
      const node = (s.gatherNodes ?? []).find((n) => !n.collected && n.def.kind === 'wild_mushroom');
      if (!node) return { err: '无未采蘑菇节点' };
      s.player.x = node.def.x + 4; s.player.y = node.def.y + 2;
      s.checkGatherHint();
      await new Promise((r2) => setTimeout(r2, 150));
      const ret = s.tryGatherInteract();
      await new Promise((r2) => setTimeout(r2, 300));
      const dm = await import('/src/systems/DiscoveryManager.ts');
      return {
        ret,
        id: node.def.id,
        discovery: dm.getDiscovery('wild_mushroom') ?? null,
      };
    });
    if (r.ret === true) return r;
    if (r.err) return r;
    await sleep(400);
  }
  return { ret: false, attempts: 4 };
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1500);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await seedDay2();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await enterGame('farm');
  await sleep(1500);
  await exitToForest();
  await skipDialogue();

  // 清空发现记录（会话模块态），保证断言从零开始
  await page.evaluate(async () => {
    const dm = await import('/src/systems/DiscoveryManager.ts');
    dm.restoreNatureDiscoverySaveData(undefined);
  });

  // R1 非雨天：Day2 09:00（雨窗前）→ 蘑菇普通发现，无 rain_forest
  await page.evaluate(() => window.debug.setTime(9, 0));
  await sleep(500);
  const dryWeather = await page.evaluate(() => window.debug.nature.weather());
  const r1 = await gatherMushroom();
  check('R1 非雨天（09:00）天气=clear', dryWeather === 'clear', `weather=${dryWeather}`);
  check('R1 非雨天采蘑菇成功', r1.ret === true, JSON.stringify(r1));
  check('R1 非雨天蘑菇无 rain_forest 特殊',
    r1.discovery && !r1.discovery.specialDiscoveries.includes('rain_forest'),
    JSON.stringify(r1.discovery));

  // R2 雨天：Day2 12:00（雨窗内）→ 蘑菇 → rain_forest
  await page.evaluate(() => window.debug.setTime(12, 0));
  await sleep(600);
  const rainWeather = await page.evaluate(() => window.debug.nature.weather());
  const r2 = await gatherMushroom();
  check('R2 雨天（12:00）天气=rain', rainWeather === 'rain', `weather=${rainWeather}`);
  check('R2 雨天采蘑菇成功', r2.ret === true, JSON.stringify(r2));
  check('R2 雨天蘑菇记录 rain_forest 特殊',
    r2.discovery && r2.discovery.specialDiscoveries.includes('rain_forest'),
    JSON.stringify(r2.discovery));

  // R3 debug.nature.weather 与雨幕同源：12:00 雨幕 active
  const rainVisual = await page.evaluate(() => {
    const s = window.__game.scene.getScene('forest');
    return { active: !!s?.rainActive, overlay: !!s?.rainOverlay };
  });
  check('R3 雨天雨幕同源（rainActive+overlay）', rainVisual.active && rainVisual.overlay, JSON.stringify(rainVisual));

  // R4 无运行时错误
  check('R4 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-rain-mushroom-special 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-rain-mushroom-special 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
