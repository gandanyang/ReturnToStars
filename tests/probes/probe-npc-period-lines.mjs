/**
 * probe-npc-period-lines.mjs — NPC 剧情覆盖日程 · 时段对白切片验收
 *
 * 验证（2026-08-16，制作人拍板：NPC 剧情覆盖日程，让世界回应时间）：
 *   小梅按日程位置切换口吻——上午在农场照料花圃、下午去森林采撷。
 *   P1 上午(10:00) farm 小梅 → 对白含 farm 时段句（清早露水/花圃）
 *   P2 下午(16:00) forest 小梅 → 对白含 forest 时段句（林子采花/扎口子）
 *   P3 同一位置同天只追加一次时段句（去重：NPC+位置）
 *   P4 无运行时错误
 *
 * 2026-08-16 天气扩面第二刀：本探针存档 day 从 2 改为 3（非雨日）——
 * day2 是雨日且 10:00 在雨窗内，「雨天 > 时段」新优先级会让雨天句抢占时段句
 * （该语义已由 probe-rain-npc C 验证）。本探针只负责"时段切片"本身，改用非雨日纯净验证。
 *
 * 运行：node tests/probes/probe-npc-period-lines.mjs
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

const FARM_LINE_A = '清早的露水重';
const FARM_LINE_B = '这片地归我照看';
const FOREST_LINE_A = '下午去林子里摘了几把野花';
const FOREST_LINE_B = '林子里的那几株';
// 时段池每池 2 条，seed=(hashCode(id)+day)%2 决定当天命中哪条——
// 探针不依赖具体某条，两个锚词任一命中即视为时段句生效（防 seed 奇偶导致假失败）。
const FARM_KEYS = [FARM_LINE_A, FARM_LINE_B];
const FOREST_KEYS = [FOREST_LINE_A, FOREST_LINE_B];
const hasAny = (lines, keys) => Array.isArray(lines) && keys.some((k) => lines.some((l) => l.includes(k)));

async function seed() {
  const save = {
    version: '0.5', savedAt: 'npc-period', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 3, hour: 10, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1, worldRestore: { oldHouse: true },
    gameState: { triggeredEvents: { ch1_awakening: true, ch1_elder_visit: true, adventurer_welcome_back: true } },
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
  throw new Error(`未能进入场景 ${scene}（实际 ${cur}）`);
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

/** 切场景（真实出口） */
async function exitTo(target) {
  await skipDialogue(5000);
  await page.evaluate(async (t) => {
    const exits = (await import('/src/data/exits.ts')).MAP_EXITS;
    const s = window.__game.scene.getScenes(true)[0];
    if (!s?.player) throw new Error('无 player');
    const zone = (exits[s.scene.key] ?? []).find((e) => e.target === t);
    if (!zone) throw new Error(`无 ${t} 出口`);
    s.player.x = zone.x + zone.w / 2;
    s.player.y = zone.y + zone.h / 2;
  }, target);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === target) { await sleep(1500); return; }
    await sleep(300);
  }
  throw new Error(`未到达 ${target}`);
}

/** 找到小梅并交互，收集对白文本 */
async function talkToGardener() {
  for (let attempt = 0; attempt < 5; attempt++) {
    await skipDialogue(3000);
    const r = await page.evaluate(async () => {
      const s = window.__game.scene.getScenes(true)[0];
      const gardener = (s.npcList ?? []).find((n) => n.id === 'gardener');
      if (!gardener) return { err: '小梅不在本场景' };
      s.player.x = gardener.targetX;
      s.player.y = gardener.targetY;
      await new Promise((r2) => setTimeout(r2, 200));
      s.tryInteract();
      await new Promise((r2) => setTimeout(r2, 600));
      const dlg = s.storyDialogue;
      if (!dlg || !dlg.isOpen()) return { retry: true };
      const lines = (dlg.lines || []).map((l) => l.text);
      return { lines };
    });
    if (r.lines) return r;
    if (r.err) return r;
    await sleep(600);
  }
  return { err: '多次尝试失败' };
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1500);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await seed();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await enterGame('farm');
  await sleep(1800);
  await skipDialogue();
  await page.evaluate(() => window.debug.setTime(10, 0)); // 上午：小梅在 farm（07:00-14:00）
  await sleep(600);

  // P1 上午 farm → 小梅含 farm 时段句（任一条；seed 当天奇偶命中第 1/2 条均可）
  const p1 = await talkToGardener();
  check('P1 上午(10:00) farm 小梅 → 含 farm 时段句',
    hasAny(p1.lines, FARM_KEYS),
    p1.err ?? JSON.stringify(p1.lines?.slice(0, 4)));
  // 关掉对话
  await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; s.storyDialogue?.close?.(true); });
  await sleep(400);

  // P3 同位置同天再对话 → 不重复时段句（去重）
  const p3 = await talkToGardener();
  check('P3 同天同位置二次对话 → 不重复追加时段句',
    Array.isArray(p3.lines) && !hasAny(p3.lines, FARM_KEYS),
    p3.err ?? JSON.stringify(p3.lines?.slice(0, 4)));
  await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; s.storyDialogue?.close?.(true); });
  await sleep(400);

  // P2 下午 forest → 小梅含 forest 时段句（任一条；经 farm 中转去森林）
  await exitTo('forest');
  await skipDialogue();
  await page.evaluate(() => window.debug.setTime(16, 0)); // 下午：小梅在 forest（14:00-18:00）
  await sleep(800);
  const p2 = await talkToGardener();
  check('P2 下午(16:00) forest 小梅 → 含 forest 时段句',
    hasAny(p2.lines, FOREST_KEYS),
    p2.err ?? JSON.stringify(p2.lines?.slice(0, 4)));

  // P4 无运行时错误
  check('P4 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-npc-period-lines 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-npc-period-lines 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
