/**
 * probe-ch2-blackdot-walk.mjs — 第二章→幕一「自然剧情流程」验收（2026-09-03 制作人复测反馈）
 *
 * 场景：不走 DevTestHub 种子，走真实存档加载路径，模拟"夜谈完成后深夜回农场"：
 *   存档状态 = 第二章全节拍完成（含 ch2_night_talk，不含 ch2_black_dot）+ 玩家在 farm 镇侧入口 (144,288) 21:00
 * 步骤：加载存档 → 按住 A(+W) 向西北自然行走 → 黑点自动触发 → 继续走进西侧缺口 → 场景切到 lighthouse
 *
 * 断言：
 *   W1 存档加载成功（day14 21:00 farm，非新档）
 *   W2 自然行走触发 ch2_black_dot（无需传送/种子）
 *   W3 缺口视觉即时出现（farmWestGapBuilt）
 *   W4 继续行走 → 进入 lighthouse 地图（灯塔开门）
 *   Z  无页面错误
 *
 * 运行：node tests/probes/probe-ch2-blackdot-walk.mjs（需 dev server :5173）
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: 'new',
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
let pass = 0, fail = 0;
function result(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const warns = [];
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') warns.push('console: ' + m.text()); });

const SAVE = {
  version: '0.5', savedAt: 'ch2-blackdot-walk', timestamp: Date.now(),
  player: { x: 144, y: 288, scene: 'farm', facing: 'up', inventory: {} },
  world: { day: 14, hour: 21, minute: 0, coins: 920, level: 4, xp: 600, stamina: 100, minedOres: [] },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
  chapter: 1,
  worldRestore: { oldHouse: true, farmWarm: true, marketSquare: true, lighthouseLit: true },
  gameState: { triggeredEvents: {
    ch1_awakening: true, ch1_bed_done: true, ch1_lamp_done: true, ch1_desk_done: true, ch1_radio_done: true,
    ch1_house_tidy_done: true, ch1_elder_visit: true,
    ch1_market_cleared: true, ch1_market_stall_1: true, ch1_market_stall_2: true, ch1_market_stall_3: true,
    ch1_spring_fair: true, crop_corn_first_harvest: true,
    dryyard_intro: true, dryyard_laozhang_craft: true, dryyard_xiya_photo: true, dryyard_afeng_help: true, dryyard_held: true,
    lighthouse_lit_seen: true, ch2_lighthouse_talked: true, ch2_clock_fixed: true, qinghe_pier_repaired: true,
    ch2_pier_repaired: true, ch2_night_talk: true, ch2_xiya_secret: true,
    adventurer_welcome_back: true, carpenter_returned: true,
  } },
};

async function waitScene(key, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!s && !!s.player;
    }, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}
async function activeMapScene() {
  return page.evaluate(() => {
    const maps = (window.__game?.scene?.getScenes(true) ?? []).filter((s) => s.player);
    return maps.length ? maps[maps.length - 1].scene.key : 'none';
  });
}

try {
  // 写入存档 → 加载游戏（真实 SaveSystem.load 路径，非 DevTestHub）
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2000);
  // 标题页有存档 → 按 Enter 继续（继续游戏）
  await page.waitForFunction(() => !!window.__game?.scene?.getScene?.('title')?.scene.isActive(), { timeout: 10000 });
  await sleep(500);
  await page.keyboard.press('Enter');
  const loaded = await waitScene('farm', 20000);
  await sleep(2500);

  const w1 = await page.evaluate(() => {
    const maps = (window.__game?.scene?.getScenes(true) ?? []).filter((s) => s.player);
    const s = maps[maps.length - 1];
    const save = JSON.parse(localStorage.getItem('return_star_save') || '{}');
    return {
      scene: s?.scene?.key,
      x: Math.round(s?.player?.x ?? -1), y: Math.round(s?.player?.y ?? -1),
      saveDay: save?.world?.day,
      timeStr: window.debug?.getTimeStr?.(),
      nightTalk: window.debug?.events?.hasTriggered?.('ch2_night_talk'),
    };
  });
  result('W1 存档加载：farm (144,288) day14 21 点段 + 夜谈已过',
    w1.scene === 'farm' && w1.saveDay === 14 && /^2[0-4]:/.test(String(w1.timeStr)) && w1.nightTalk === true,
    JSON.stringify(w1));

  // 自然行走阶段1：小步脉冲斜向西北（W 80ms + A 80ms 交替），逐轮查黑点；
  // 一触发立即停步（步幅小，y 仍在 208 以下，不会误入灯塔触发区）
  for (let i = 0; i < 20; i++) {
    await page.keyboard.down('KeyW');
    await sleep(80);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyA');
    await sleep(80);
    await page.keyboard.up('KeyA');
    const st = await page.evaluate(() => window.debug?.events?.hasTriggered?.('ch2_black_dot'));
    if (st === true) break;
  }
  await sleep(500);

  const sample = () => page.evaluate(() => {
    const maps = (window.__game?.scene?.getScenes(true) ?? []).filter((s) => s.player);
    const s = maps[maps.length - 1];
    const texts = [];
    document.querySelectorAll('div,p,span').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (t.length > 4 && t.length < 80 && el.children.length === 0) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && r.bottom > 480) texts.push(t);
      }
    });
    return {
      mapKey: s?.mapKey,
      x: Math.round(s?.player?.x ?? -1), y: Math.round(s?.player?.y ?? -1),
      dotDebug: window.debug?.events?.hasTriggered?.('ch2_black_dot'),
      gapBuilt: s?.farmWestGapBuilt,
      gate: s ? window.debug?.interactionRouter?.checkGate?.(s.buildGateSnapshot?.() ?? {})?.type : null,
      dialogOpen: s?.storyDialogue?.isOpen?.() ?? false,
      texts: texts.slice(0, 4),
    };
  });
  const w2a = await sample();
  console.log('  [W2 farm 采样]', JSON.stringify(w2a));
  result('W2 自然行走触发 ch2_black_dot（黑点钩子，游戏注册表）', w2a.dotDebug === true, JSON.stringify(w2a));
  result('W3 缺口视觉即时出现（仍在 farm 时验证）',
    w2a.mapKey === 'farm' && w2a.gapBuilt === true, JSON.stringify(w2a));

  // 自然行走阶段2：A+W 同按向西北继续走（从黑点触发点向缺口逼近），轮询场景切换
  await page.keyboard.down('KeyA');
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 25; i++) {
    await sleep(120);
    if ((await activeMapScene()) !== 'farm') break;
  }
  await page.keyboard.up('KeyA'); await page.keyboard.up('KeyW');
  await sleep(2500); // 等切换完成

  const w4 = await activeMapScene();
  result('W4 继续行走 → 进入灯塔地图', w4 === 'lighthouse', `scene=${w4}`);
} finally {
  const z = warns.length === 0;
  result('Z 无页面错误', z, warns.slice(0, 5).join(' | '));
  console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}
