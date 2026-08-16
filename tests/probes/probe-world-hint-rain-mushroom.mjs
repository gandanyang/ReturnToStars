/**
 * probe-world-hint-rain-mushroom.mjs — P0.5 世界规律引导验收（雨天→森林→蘑菇）
 *
 * 制作人拍板（2026-08-16）：不做任务式引导，做"生活发现式引导"三级：
 *   ① 第一场雨（farm）→ 小梅顺口提起"后山蘑菇"（明确告知，无任务）
 *   ② 雨天第一次进森林 → 环境暗示"地上好像多了些东西"
 *   ③ 第一次雨中发现蘑菇 → 发现文本点破规律；之后再采只显示普通反馈
 *
 * 验证：
 *   H1 第一场雨 farm → 小梅提示对白自动播放（一次）
 *   H2 雨天进 forest → 环境暗示文本（一次）
 *   H3 第一次雨中发现蘑菇 → "发现：野蘑菇" + 规律文本
 *   H4 第二次雨天采蘑菇 → 仅普通反馈（不再点破）
 *   H5 重进场景不重复触发（triggerOnce 持久化）
 *   H6 无运行时错误
 *
 * 运行：node tests/probes/probe-world-hint-rain-mushroom.mjs
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

async function seedDay2Farm() {
  const save = {
    version: '0.5', savedAt: 'world-hint', timestamp: Date.now(),
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

async function exitTo(target, timeoutMs = 20000) {
  await skipDialogue(5000);
  await page.evaluate(async (t) => {
    const exits = (await import('/src/data/exits.ts')).MAP_EXITS;
    const s = window.__game.scene.getScenes(true)[0];
    if (!s?.player) throw new Error('当前场景无 player');
    const zone = (exits[s.scene.key] ?? []).find((e) => e.target === t);
    if (!zone) throw new Error(`场景 ${s.scene.key} 无通向 ${t} 出口`);
    s.player.x = zone.x + zone.w / 2;
    s.player.y = zone.y + zone.h / 2;
  }, target);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === target) { await sleep(1500); return; }
    await sleep(300);
  }
  throw new Error(`出口切换失败：未到达 ${target}`);
}

/** 读当前对白文本 / 反馈文本 */
async function currentText() {
  return page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return {
      dialogue: s?.storyDialogue?.textEl?.textContent ?? '',
      feedback: s?.dialogueText?.text ?? '',
      dialogueOpen: !!(s?.storyDialogue && s.storyDialogue.isOpen && s.storyDialogue.isOpen()),
    };
  });
}

/** 采蘑菇（带对白关闭重试；森林进入/时间跳变后可能短暂有自动对白） */
async function gatherMushroomRetry() {
  for (let attempt = 0; attempt < 5; attempt++) {
    await skipDialogue(3000);
    const r = await page.evaluate(async () => {
      const s = window.__game.scene.getScene('forest');
      if (s.storyDialogue?.isOpen?.()) return { blocked: 'dialogue' };
      const node = (s.gatherNodes ?? []).find((n) => !n.collected && n.def.kind === 'wild_mushroom');
      if (!node) return { err: '无蘑菇节点' };
      const dm = await import('/src/systems/DiscoveryManager.ts');
      const before = {
        raining: (await import('/src/systems/WeatherSystem.ts')).isCurrentlyRaining(),
        hasSpecial: dm.hasSpecialDiscovery('wild_mushroom', 'rain_forest'),
        record: dm.getDiscovery('wild_mushroom') ?? null,
      };
      s.player.x = node.def.x + 4; s.player.y = node.def.y + 2;
      s.checkGatherHint();
      await new Promise((r2) => setTimeout(r2, 150));
      const ret = s.tryGatherInteract();
      await new Promise((r2) => setTimeout(r2, 400));
      return {
        ret,
        feedback: s.dialogueText?.text ?? '',
        before,
        after: dm.getDiscovery('wild_mushroom') ?? null,
        nearest: s.nearestGatherIdx,
        nodeId: node.def.id,
        dist: Math.hypot(s.player.x - node.def.x, s.player.y - node.def.y),
        nodeCollected: node.collected,
        dialogueOpen: !!s.storyDialogue?.isOpen?.(),
      };
    });
    if (r.ret === true) return r;
    if (r.err) return r;
    await sleep(500);
  }
  return { ret: false, attempts: 5 };
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
  await skipDialogue();

  // ── H1 第一场雨 → farm 小梅提示 ──
  await page.evaluate(() => window.debug.setTime(10, 30)); // 进入雨窗
  await sleep(4000); // 等 hourly 天气检查 + 提示触发
  let t = await currentText();
  const h1Seen = t.dialogue.includes('后山的蘑菇') || t.dialogue.includes('下雨啦');
  check('H1 第一场雨 farm → 小梅提示对白', h1Seen || t.dialogueOpen, JSON.stringify(t));
  await skipDialogue();

  // ── H2 雨天进 forest → 环境暗示 ──
  await exitTo('forest');
  await sleep(600);
  t = await currentText();
  check('H2 雨天进森林 → 环境暗示文本', t.feedback.includes('雨水顺着树叶滴下来'), JSON.stringify(t));

  // ── H3 第一次雨中发现蘑菇 → 发现文本 ──
  const g1 = await gatherMushroomRetry();
  check('H3 第一次雨中发现蘑菇 → 发现文本', g1.ret === true && g1.feedback.includes('发现：野蘑菇'),
    JSON.stringify(g1));

  // ── H4 第二次雨天采蘑菇 → 仅普通反馈 ──
  const g2 = await gatherMushroomRetry();
  check('H4 第二次雨天采蘑菇 → 仅普通反馈', g2.ret === true && g2.feedback.includes('采到了') && !g2.feedback.includes('发现：野蘑菇'),
    JSON.stringify(g2));

  // ── H5 triggerOnce 持久化：重进 farm/forest 不重复 ──
  await exitTo('farm');
  await sleep(800);
  await page.evaluate(() => window.debug.setTime(13, 0)); // 仍在雨窗
  await sleep(2500);
  t = await currentText();
  check('H5 重进 farm 不重复小梅提示', !t.dialogue.includes('后山的蘑菇'), JSON.stringify(t));
  await exitTo('forest');
  await sleep(600);
  t = await currentText();
  check('H5b 重进 forest 不重复环境暗示', !t.feedback.includes('雨水顺着树叶滴下来'), JSON.stringify(t));

  // ── H6 无运行时错误 ──
  check('H6 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-world-hint-rain-mushroom 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-world-hint-rain-mushroom 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
