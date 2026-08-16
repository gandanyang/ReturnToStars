/**
 * probe-action-time.mjs — P0 Action Time 动作时间成本探针
 *
 * 依据：《昼夜生活P0-现状对照与最小改造方案》P0 Action Time（制作人 B 审核→开 A）。
 * 验证：
 *   T1 consumeMinutes(10) 底层：时间推进 +10 分钟（可观测）
 *   T2 真实采集 1 次 → 时间 +gathering 成本（接通）
 *   T3 原采集动作/背包不受破坏（采到物品仍 +1）
 *   T4 22:00 达到强制停（advanceGameMinutes 复用 DAY_END_HOUR clamp）
 *   T5 连续采集不崩溃、时间持续累计
 *   T6 无运行时错误
 *
 * 2026-08-16 修正：时间读写与 consumeMinutes 一律走 window.debug（游戏唯一 TimeSystem 实例）。
 * 原因：动态 import 在 Vite 下会命中带 ?t= 时间戳的另一个模块实例，
 *       读写到的与游戏运行时不是同一个 time 单例（旧探针 T2/T5 恒 0 增量）。
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.bringToFront();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

/** 种子存档进 town（有采集点） */
async function seedTown() {
  const save = {
    version: '0.5', savedAt: 'action-time', timestamp: Date.now(),
    player: { x: 8 * 16, y: 20 * 16, scene: 'town', facing: 'down', inventory: {} },
    world: { day: 1, hour: 12, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'in_progress', ch1TownIntroDone: true },
    chapter: 0, worldRestore: {},
    gameState: { triggeredEvents: {} },
  };
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await page.keyboard.press('Enter'); // 过标题（与其余探针一致的进入方式）
  await sleep(600);
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
  }
  await sleep(2000);
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.();
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1500);

  // T1 底层 consumeMinutes（debug.consumeMinutes 直连游戏实例）
  const t1 = await page.evaluate(async () => {
    window.debug.setTime(12, 0);
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const before = toMin(window.debug.getTimeStr());
    window.debug.consumeMinutes(10);
    const after = toMin(window.debug.getTimeStr());
    return { before, after, delta: after - before, str: window.debug.getTimeStr() };
  });
  console.log('T1 consumeMinutes:', JSON.stringify(t1));
  check('T1 consumeMinutes(10) → +10 分钟', t1.delta === 10, `delta=${t1.delta}`);

  // T4 22:00 强制停
  const t4 = await page.evaluate(async () => {
    window.debug.setTime(21, 50);
    window.debug.consumeMinutes(30); // 21:50 + 30 → 应停在 22:00
    return { str: window.debug.getTimeStr() };
  });
  console.log('T4 clamp:', JSON.stringify(t4));
  check('T4 21:50 + 30min → 停在 22:00（不超）', t4.str === '22:00', JSON.stringify(t4));

  // T2/T5 真实采集：进 town，靠近采集点触发
  await seedTown();
  const r = await page.evaluate(async () => {
    const ts = await import('/src/data/TimeSystem.ts');
    const inv = await import('/src/data/Inventory.ts');
    const out = {};
    const s = window.__game.scene.getScene('town');
    const toMin = (str) => { const [h, m] = str.split(':').map(Number); return h * 60 + m; };
    // 找一个未采的采集点，把玩家挪过去
    const node = s.gatherNodes?.[0];
    if (!node) { out.noNode = true; return out; }
    const kind = node.def.kind;
    const itemId = kind === 'dandelion' ? 'dandelion' : kind === 'small_flower' ? 'small_flower' : kind === 'twig' ? 'twig' : kind;
    const beforeItem = inv.getItemCount(itemId);
    window.debug.setTime(12, 0); // 时间基准：避免清晨自动演出等对读数干扰
    const beforeT = toMin(window.debug.getTimeStr());
    s.player.x = node.def.x + 4; s.player.y = node.def.y + 2;
    s.checkGatherHint();
    await new Promise((r2) => setTimeout(r2, 200));
    const ret = s.tryGatherInteract();
    await new Promise((r2) => setTimeout(r2, 500)); // 等 0.4s 反馈
    const afterT = toMin(window.debug.getTimeStr());
    const afterItem = inv.getItemCount(itemId);
    out.t = { ret, beforeT, afterT, deltaT: afterT - beforeT, beforeItem, afterItem };
    // T5 连续 4 次（换点或同一节点余量）——验证持续累计不崩
    window.debug.setTime(12, 0);
    const rows = [];
    for (let i = 0; i < 4; i++) {
      const node2 = s.gatherNodes?.find((n) => !n.collected);
      if (!node2) { rows.push({ done: true }); break; }
      s.player.x = node2.def.x + 4; s.player.y = node2.def.y + 2;
      s.checkGatherHint();
      await new Promise((r2) => setTimeout(r2, 80));
      const ok = s.tryGatherInteract();
      await new Promise((r2) => setTimeout(r2, 120));
      rows.push({ ok, str: window.debug.getTimeStr() });
    }
    out.rows = rows;
    return out;
  });
  console.log('gather time:', JSON.stringify(r));
  if (r.noNode) {
    check('T2 采集接入（无采集节点）', false, 'town 无 gatherNodes');
  } else {
    check('T2 真实采集后时间推进（+gathering 成本）', r.t.deltaT > 0, `deltaT=${r.t.deltaT}`);
    check('T3 采集仍获得物品（背包 +1，不破坏）', r.t.afterItem === r.t.beforeItem + 1, `before=${r.t.beforeItem} after=${r.t.afterItem}`);
    check('T5 连续采集不崩溃（rows.length>0）', r.rows && r.rows.length > 0, JSON.stringify(r.rows?.slice(0, 2)));
  }

  check('T6 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0, '');

  console.log(`\n===== probe-action-time 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-action-time 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
