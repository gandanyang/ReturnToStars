/**
 * probe-rain-hint-after-adventurer.mjs — 复现并验证：阿风欢迎演出挡住雨天提示的修复（2026-08-16）
 *
 * 制作人实测：ch1_elder_visit 种子睡到第 2 天 → 触发的是阿风欢迎对白，小梅雨天提示没出现。
 * 根因：tryRainMushroomHint 原挂在"小时切换块"，阿风对白（进 farm 1s 后自动播）占住对话的
 * 那一帧被 storyDialogue.isOpen() 挡掉，要再等一小时才重试，雨窗 6 小时内大概率错过。
 * 修复：提示检查移到每帧调用（内部守卫保证只播一次）。
 *
 * 验证：
 *   A1 进 farm（阿风欢迎条件满足）→ 阿风欢迎对白先触发
 *   A2 阿风对白结束后 → 小梅雨天提示随后触发（不再被吞）
 *   A3 两个 triggerOnce 均已持久化
 *   A4 无运行时错误
 *
 * 运行：node tests/probes/probe-rain-hint-after-adventurer.mjs
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

/** 种子：ch1_elder_visit 同款（townIntroDone=true → 阿风欢迎可触发），但直接进 farm */
async function seed() {
  const save = {
    version: '0.5', savedAt: 'rain-hint-after-adventurer', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 2, hour: 7, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1, worldRestore: { oldHouse: true },
    gameState: { triggeredEvents: { ch1_awakening: true, ch1_elder_visit: true } },
  };
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
}

async function enterFarm() {
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === 'farm') return;
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
  throw new Error('未能进入 farm');
}

/** 读取当前对白文本 + 事件触发状态 */
async function state() {
  return page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return {
      dialogue: s?.storyDialogue?.textEl?.textContent ?? '',
      open: !!(s?.storyDialogue && s.storyDialogue.isOpen && s.storyDialogue.isOpen()),
      adventurer: window.debug.events.hasTriggered('adventurer_welcome_back'),
      rainHint: window.debug.events.hasTriggered('world_hint_rain_mushroom'),
    };
  });
}

/** 推进对白直到关闭，记录每行文本 */
async function advanceThrough(maxMs = 30000) {
  const lines = [];
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const st = await state();
    if (st.dialogue && !lines.includes(st.dialogue)) lines.push(st.dialogue);
    if (!st.open) return lines;
    await page.keyboard.press('Enter');
    await sleep(350);
  }
  return lines;
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
  await enterFarm();
  await sleep(3000); // 等阿风演出（1s delayedCall + 1.8s 对白延迟）

  // 进入雨窗（10:30）——阿风对白应正在播放或刚播完
  await page.evaluate(() => window.debug.setTime(10, 30));

  // 先等阿风欢迎对白出现
  let seenAdventurer = false;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      const st = await state();
      if (st.adventurer || st.dialogue.includes('你回来了')) { seenAdventurer = true; break; }
      await sleep(300);
    }
  }
  check('A1 阿风欢迎对白先触发', seenAdventurer, JSON.stringify(await state()));

  // 把阿风对白推完 → 小梅提示应在之后自动出现
  const lines = await advanceThrough();
  let seenRainHint = false;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const st = await state();
      if (st.rainHint || st.dialogue.includes('后山的蘑菇')) { seenRainHint = true; break; }
      await sleep(400);
    }
  }
  check('A2 阿风对白结束后小梅雨天提示出现', seenRainHint, JSON.stringify(await state()));

  const final = await state();
  check('A3 两个事件均已持久化', final.adventurer && final.rainHint, JSON.stringify(final));
  check('A4 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-rain-hint-after-adventurer 结果: ${pass} 通过 / ${fail} 失败 =====`);
  console.log('对白顺序:', lines.join(' → ').slice(0, 200));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-rain-hint-after-adventurer 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
