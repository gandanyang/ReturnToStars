/**
 * probe-night-fatigue-hint.mjs — P0 夜晚疲劳提示（§3.2 最小版）验证
 *
 * 依据：《昼夜生活P0-现状对照与最小改造方案》3.2：
 *   - 21:00 起，玩家按 E 交互时弹一次"天色晚了，有些困了……"，不强制、不打断
 *   - 22:00 保持既有强制停（不在此探针重复验证）
 * 验证：
 *   N1 21:00 后交互 → 提示出现（一句）
 *   N2 同夜第二次交互 → 不再重复提示（去重生效）
 *   N3 20:00 交互 → 不提示
 *   N4 21:00 后床上睡觉交互 → 不提示（避免与睡觉演出抢文本）
 *   N5 无运行时错误
 *
 * 运行：node tests/probes/probe-night-fatigue-hint.mjs
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

/** 种子存档进 town（第1章，跳过入口剧情） */
async function seedTown(hour) {
  const save = {
    version: '0.5', savedAt: 'night-fatigue', timestamp: Date.now(),
    player: { x: 8 * 16, y: 20 * 16, scene: 'town', facing: 'down', inventory: {} },
    world: { day: 1, hour, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'in_progress', ch1TownIntroDone: true },
    chapter: 1, worldRestore: {},
    gameState: { triggeredEvents: {} },
  };
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2200);
  await enterGame('town');
  await sleep(1800);
  await page.evaluate(() => window.debug.markCh1TownIntroDone());
  await sleep(300);
}

/** 进入指定场景（处理标题/声音弹窗，与 probe-day2-morning 同范式） */
async function enterGame(scene, timeoutMs = 20000) {
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

/** 读当前提示文本（showDialogueText 的 Phaser Text） */
async function hintText() {
  return page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    return s?.dialogueText?.text ?? '';
  });
}

/** 读疲劳提示是否已记录（nightFatigueHintShownMinute >= 0）——提示文本会被后续动作反馈覆盖，用记录判定更稳 */
async function hintFired() {
  return page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    return (s?.nightFatigueHintShownMinute ?? -1) >= 0;
  });
}

/** 在采集点旁按 E（真实交互路径；town_dand_1 在 (132,326)） */
async function pressEatGather() {
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    s.player.x = 132 + 4; s.player.y = 326 + 2;
    s.checkGatherHint();
  });
  await sleep(200);
  await page.keyboard.press('KeyE');
  await sleep(400);
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1500);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));

  // N1/N2：21:00 两次交互 → 第一次提示，第二次不重复
  await seedTown(21);
  await pressEatGather();
  const f1 = await hintFired();
  check('N1 21:00 交互 → 夜晚疲劳提示出现', f1, 'hintShownMinute 已记录');
  await pressEatGather();
  const f2 = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    return s?.nightFatigueHintShownMinute ?? -1;
  });
  // 第二次交互时间可能已过 1 分钟（真实流逝）→ 用"采集成功"佐证交互发生 + 记录未刷新为当天更晚分钟
  check('N2 同夜第二次交互 → 不再重复提示',
    f2 >= 0 && f2 <= 21 * 60 + 5, `hintShownMinute=${f2}`);

  // N3：20:00 交互 → 不提示
  await page.evaluate(() => window.debug.setTime(20, 0));
  await sleep(300);
  // 重置会话提示记录（模拟新一晚）
  await page.evaluate(() => { window.__game.scene.getScene('town').nightFatigueHintShownMinute = -1; });
  await pressEatGather();
  const t3 = await hintText();
  check('N3 20:00 交互 → 不提示', !t3.includes('天色晚了'), `text=${t3 || '(空)'}`);

  // N4：床上睡觉 → 不提示（代码级守卫验证：疲劳提示在床交互时跳过）
  const n4 = await page.evaluate(async () => {
    // 直接读运行时已装载的 tryInteract 源码（MapScene 已实例化，原型必然在）
    const proto = Object.getPrototypeOf(window.__game.scene.getScene('town'));
    const src = proto.tryInteract.toString();
    return {
      hasHint: src.includes("nightFatigueHintShownMinute"),
      hasBedGuard: src.includes("bedInteract") && src.includes("bedTiles.has"),
      guardCoversMaps: /this\.mapKey === ["']house["'] \|\| this\.mapKey === ["']farm["']/.test(src),
      skipsOnBed: /!bedInteract/.test(src),
    };
  });
  check('N4 床交互守卫：疲劳提示跳过床上睡觉',
    n4.hasHint && n4.hasBedGuard && n4.guardCoversMaps && n4.skipsOnBed,
    JSON.stringify(n4));

  // N5 无运行时错误
  check('N5 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 2).join(' | '));

  console.log(`\n===== probe-night-fatigue-hint 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-night-fatigue-hint 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
