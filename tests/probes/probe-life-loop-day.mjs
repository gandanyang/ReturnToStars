/**
 * probe-life-loop-day.mjs — 生活日循环最小闭环体验验收（2026-08-16）
 *
 * 制作人结论（2026-08-16）：昼夜生活 P0 验收通过，暂缓 P1，先实际试玩验证
 * "自然环境 → 发现 → 行动耗时 → NPC 日程 → 夜晚 → 睡眠"这条生活循环。
 *
 * 本探针把"完整一天"压缩为确定性可回归场景（真实游戏实例驱动，非模拟）：
 *   L1 清晨 farm：第 2 天（雨日）雨幕/雨粒子可见
 *   L2 上午 farm：小梅在 farm（日程 07:00→farm 花圃）
 *   L3 上午 forest：真实采集 3 次 → 物品 +3 且时间随采集推进（Action Time）
 *   L4 下午 forest：小梅在 forest（日程 14:00→森林采撷）
 *   L5 夜晚 forest：萤火虫氛围（≥18 时创建）
 *   L6 21:00 交互 → 夜晚疲劳提示（不强制）
 *   L7 床上睡觉 → 次日 06:00（day+1，作物结算链路）
 *   L8 全过程无运行时错误
 * 截图：tests/probes/test-screenshots/life-loop-*.png（供人工体验验收参考）
 *
 * 运行：node tests/probes/probe-life-loop-day.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
mkdirSync(SHOT_DIR, { recursive: true });

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

/** 写入种子存档：第1章 day2（雨日），farm 出生 */
async function seedDay2Farm() {
  const save = {
    version: '0.5', savedAt: 'life-loop-day', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 2, hour: 7, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: { oldHouse: true },
    gameState: { triggeredEvents: { ch1_awakening: true, ch1_elder_visit: true } },
  };
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
}

/** 进入指定场景（处理标题/声音弹窗，probe-day2-morning 同范式） */
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

/** 等待场景内 player 就绪 */
async function waitPlayer(scene, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ready = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!(s && s.player);
    }, scene);
    if (ready) return;
    await sleep(250);
  }
  throw new Error(`场景 ${scene} player 未就绪`);
}

/**
 * 通过真实出口切场景：把玩家挪到当前场景通向目标场景的出口触发区，
 * 由游戏自身的出口判定（含淡出/出生点）完成切换——不直接 scene.start。
 */
async function exitTo(target, timeoutMs = 20000) {
  await skipDialogue(5000); // 出口检测在对白打开时不触发，先关掉自动对白
  await page.evaluate(async (t) => {
    const exits = (await import('/src/data/exits.ts')).MAP_EXITS;
    const s = window.__game.scene.getScenes(true)[0];
    const zone = (exits[s.scene.key] ?? []).find((e) => e.target === t);
    if (!zone) throw new Error(`场景 ${s.scene.key} 没有通向 ${t} 的出口`);
    s.player.x = zone.x + zone.w / 2;
    s.player.y = zone.y + zone.h / 2;
  }, target);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === target) { await waitPlayer(target); await sleep(1500); return; }
    await sleep(300);
  }
  throw new Error(`出口切换失败：未到达 ${target}`);
}

/** 沿路径逐段出口切换（forest 只能直达 farm/mine，town 需经 farm 中转） */
async function navigateTo(path, timeoutMs = 30000) {
  for (const step of path) await exitTo(step, timeoutMs);
}

/** 跳过当前对白直到关闭（Enter 轮询；forest 进入时可能有自动对白） */
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

/** 当前场景 NPC id 列表 */
async function npcIds(scene) {
  return page.evaluate((k) => {
    const s = window.__game?.scene?.getScene?.(k);
    return (s?.npcList ?? []).map((n) => n.id);
  }, scene);
}

/** 在森林采集点旁按 E 采集（真实交互路径），返回时间字符串变化 */
async function gatherAt(node) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await skipDialogue(3000);
    const r = await page.evaluate(async (n) => {
      const s = window.__game.scene.getScene('forest');
      if (s.storyDialogue?.isOpen?.()) return { ret: false, blocked: 'dialogue' };
      s.player.x = n.def.x + 4; s.player.y = n.def.y + 2;
      s.checkGatherHint();
      await new Promise((r2) => setTimeout(r2, 150));
      const t0 = window.debug.getTimeStr();
      const ret = s.tryGatherInteract();
      await new Promise((r2) => setTimeout(r2, 250));
      return { ret, t0, t1: window.debug.getTimeStr() };
    }, node);
    if (r.ret) return r;
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
  await seedDay2Farm();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await enterGame('farm');
  await sleep(1500);

  // ── L1 清晨 farm：雨日 → 雨幕/粒子 ──
  await page.evaluate(() => window.debug.setTime(10, 30)); // 雨窗 10:00-16:00；跨小时触发 hourly 天气检查
  await sleep(4000); // 等待 startRain 完成
  // 2026-08-30 修复：P3 天气迁移后 rain 状态在 WeatherDirector（scene.rainActive/rainOverlay
  // 已不存在，旧读法自迁移起恒 false）——改走公开 API isRaining / hasRainVisuals
  const rain = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    const wd = s?.weatherDirector;
    return { active: !!wd?.isRaining, overlay: !!wd?.hasRainVisuals };
  });
  check('L1 雨日清晨 farm 雨幕可见（isRaining + hasRainVisuals）', rain.active && rain.overlay, JSON.stringify(rain));
  await page.screenshot({ path: join(SHOT_DIR, 'life-loop-01-farm-rain.png') });

  // ── L2 上午 farm：小梅在 farm（日程 07:00→farm） ──
  const farmNpcs = await npcIds('farm');
  check('L2 上午 farm 小梅在（日程 07:00→farm）', farmNpcs.includes('gardener'), `farm npcList=${JSON.stringify(farmNpcs)}`);

  // ── L3 上午 forest：真实采集 ×3 → 物品 +3 且时间随采集推进 ──
  await exitTo('forest');
  await skipDialogue();
  await page.evaluate(() => window.debug.setTime(8, 0));
  await sleep(500);
  const nodes = await page.evaluate(() => {
    const s = window.__game.scene.getScene('forest');
    return (s?.gatherNodes ?? []).map((n, i) => ({ i, id: n.def.id, x: n.def.x, y: n.def.y, collected: n.collected }));
  });
  const gatherRows = [];
  for (const nd of nodes.filter((n) => !n.collected).slice(0, 3)) {
    const r = await gatherAt({ def: { x: nd.x, y: nd.y } });
    gatherRows.push({ id: nd.id, ...r });
  }
  const invAfter = await page.evaluate(async () => {
    // 主实例背包读数（探针统一走 window.debug，避免 Vite 双模块分裂——
    // 主 bundle 采集 addItem 写入 vs 动态 import ?t= 副本读取不一致）
    return {
      mushroom: window.debug.getItemCount('wild_mushroom'),
      twig: window.debug.getItemCount('twig'),
      flower: window.debug.getItemCount('small_flower'),
    };
  });
  const timeAdvanced = gatherRows.every((r) => r.ret === true && r.t1 !== r.t0);
  check('L3 森林采集 3 次 → 全部成功且时间随采集推进', timeAdvanced, JSON.stringify(gatherRows));
  check('L3b 采集物品入包（蘑菇/树枝/花 ≥1）',
    invAfter.mushroom + invAfter.twig + invAfter.flower >= gatherRows.length,
    JSON.stringify(invAfter));
  await page.screenshot({ path: join(SHOT_DIR, 'life-loop-02-forest-gather.png') });

  // ── L4 下午 forest：小梅在 forest（日程 14:00→森林采撷） ──
  await page.evaluate(() => window.debug.setTime(16, 0));
  await sleep(800);
  // 重进 forest（场景内 NPC 按当前时间重建），确认 16:00 小梅在森林
  await navigateTo(['farm', 'forest']);
  await skipDialogue();
  const forestNpcs = await npcIds('forest');
  check('L4 下午 forest 小梅在（日程 14:00→forest）', forestNpcs.includes('gardener'), `forest npcList=${JSON.stringify(forestNpcs)}`);

  // ── L5 夜晚 forest：萤火虫氛围 ──
  await page.evaluate(() => window.debug.setTime(19, 0));
  await sleep(500);
  // 萤火虫在场景 create 时按当时时间生成（≥18 时）→ 设好夜晚时间后重进 forest
  await navigateTo(['farm', 'forest']);
  await skipDialogue();
  await page.evaluate(() => window.debug.setTime(19, 0));
  await sleep(800);
  const fireflies = await page.evaluate(() => {
    const s = window.__game.scene.getScene('forest');
    return (s?.forestFireflies ?? []).length;
  });
  check('L5 夜晚 forest 萤火虫氛围存在', fireflies > 0, `forestFireflies=${fireflies}`);
  await page.screenshot({ path: join(SHOT_DIR, 'life-loop-03-forest-night.png') });

  // ── L6 21:00 交互 → 夜晚疲劳提示 ──
  // town 有未采采集点（forest 的点已在 L3 采完），且需真实交互触发 tryInteract
  await navigateTo(['farm', 'town']);
  await skipDialogue();
  await page.evaluate(() => window.debug.setTime(21, 0));
  await sleep(400);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    s.nightFatigueHintShownMinute = -1; // 模拟"当夜第一次交互"
  });
  await sleep(400);
  const fat = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('town');
    const node = (s.gatherNodes ?? []).find((n) => !n.collected);
    if (!node) return { ret: false, shown: false, text: '', err: 'town 无未采点' };
    s.player.x = node.def.x + 4; s.player.y = node.def.y + 2;
    s.checkGatherHint();
    await new Promise((r) => setTimeout(r, 150));
    // 必须走 tryInteract（疲劳提示挂在 tryInteract 入口；直接调 tryGatherInteract 会绕过）
    const ret = s.tryInteract();
    return { ret, shown: s.nightFatigueHintShownMinute >= 0, text: s.dialogueText?.text ?? '' };
  });
  check('L6 21:00 交互 → 夜晚疲劳提示（不强制）', fat.shown, JSON.stringify(fat));
  await page.screenshot({ path: join(SHOT_DIR, 'life-loop-04-fatigue-hint.png') });

  // ── L7 回 farm 睡觉 → 次日 06:00 ──
  await exitTo('farm');
  await skipDialogue();
  // farm 木屋地板（睡觉判定区）：取首个真实床格
  const bedTile = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    const t = [...(s.bedTiles ?? [])][0];
    return t ?? '5,21';
  });
  const [bc, br] = bedTile.split(',').map(Number);
  await page.evaluate(({ x, y }) => {
    const s = window.__game.scene.getScene('farm');
    s.player.x = x; s.player.y = y;
  }, { x: bc * 16 + 8, y: br * 16 + 8 });
  await page.evaluate(() => window.debug.setTime(21, 30));
  await sleep(400);
  await page.keyboard.press('KeyE');
  await sleep(1500);
  const afterSleep = await page.evaluate(() => {
    const ts = window.debug.getTimeStr();
    return { timeStr: ts };
  });
  const dayAfter = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('return_star_save') || '{}');
    return save.world?.day ?? -1;
  });
  check('L7 床上睡觉 → 次日清晨 06:00-06:10（day+1）',
    /^06:0\d$/.test(afterSleep.timeStr) && dayAfter >= 3,
    `time=${afterSleep.timeStr} savedDay=${dayAfter}`);
  await page.screenshot({ path: join(SHOT_DIR, 'life-loop-05-next-morning.png') });

  // ── L8 无运行时错误 ──
  check('L8 全过程无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-life-loop-day 结果: ${pass} 通过 / ${fail} 失败 =====`);
  console.log(`截图：${SHOT_DIR}\\life-loop-*.png`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-life-loop-day 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
