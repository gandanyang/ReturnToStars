/**
 * probe-riverside-xiya.mjs — NPC 剧情覆盖日程扩展 · 河畔夏雅验收
 *
 * 验证（2026-08-16）：夏雅下午 16-18 时在青禾河畔看水，18 点后回农场——
 * "上午来她在农场，傍晚来她已经到了河边"的日程感知。
 *   R1 16:00 进 qinghe_river → 河畔夏雅精灵存在
 *   R2 靠近按 E → 河畔专属对白（看水/爷爷也坐这儿）
 *   R3 18:00 后进 qinghe_river → 夏雅不在（已回农场）
 *   R4 当天已触发 → 重进不重复（riversideXiyaDay 存档）
 *   R5 无运行时错误
 *
 * 运行：node tests/probes/probe-riverside-xiya.mjs
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

async function seed() {
  const save = {
    version: '0.5', savedAt: 'riverside-xiya', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 2, hour: 10, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [], questState: 'completed' },
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

/** 从 town 进 qinghe_river（南侧出口） */
async function enterRiverside() {
  await skipDialogue(5000);
  await page.evaluate(async () => {
    const exits = (await import('/src/data/exits.ts')).MAP_EXITS;
    const s = window.__game.scene.getScenes(true)[0];
    if (!s?.player) throw new Error('无 player');
    const zone = (exits[s.scene.key] ?? []).find((e) => e.target === 'qinghe_river');
    if (!zone) throw new Error(`无 ${s.scene.key} → qinghe_river 出口`);
    s.player.x = zone.x + zone.w / 2;
    s.player.y = zone.y + zone.h / 2;
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === 'qinghe_river') { await sleep(1800); return; }
    await sleep(300);
  }
  throw new Error('未进入 qinghe_river');
}

/** 读取河畔夏雅状态 */
async function xiyaState() {
  return page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    return {
      sprite: !!s?.riversideXiya,
      label: !!s?.riversideXiyaLabel,
      day: s?.riversideXiyaDay ?? 0,
      time: window.debug.getTimeStr(),
    };
  });
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

  // 先去 town（qinghe_river 出口在 town 南侧）
  await skipDialogue(5000);
  await page.evaluate(async () => {
    const exits = (await import('/src/data/exits.ts')).MAP_EXITS;
    const s = window.__game.scene.getScenes(true)[0];
    const zone = (exits[s.scene.key] ?? []).find((e) => e.target === 'town');
    if (zone) { s.player.x = zone.x + zone.w / 2; s.player.y = zone.y + zone.h / 2; }
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === 'town') break;
    await sleep(300);
  }
  await sleep(1500);

  // R1 16:00 进河畔 → 夏雅在
  await page.evaluate(() => window.debug.setTime(16, 0));
  await sleep(500);
  await enterRiverside();
  await skipDialogue();
  const r1 = await xiyaState();
  check('R1 16:00 河畔夏雅精灵存在', r1.sprite && r1.label, JSON.stringify(r1));

  // R2 靠近按 E → 河畔专属对白
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    const x = s.riversideXiya?.x;
    const y = s.riversideXiya?.y;
    if (x !== undefined && y !== undefined) { s.player.x = x + 4; s.player.y = y + 2; }
  });
  await sleep(200);
  await page.keyboard.press('KeyE');
  await sleep(800);
  const r2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    const dlg = s.storyDialogue;
    return {
      open: !!(dlg && dlg.isOpen && dlg.isOpen()),
      lines: (dlg?.lines ?? []).map((l) => l.text),
    };
  });
  check('R2 靠近按 E → 河畔看水对白',
    r2.open &&
    // 天气扩面第二刀（2026-08-16）：雨日（存档 day2）播雨天变体「下雨天也来看水」；
    // 晴日播晴日版「怎么一个人来河边」——任一版本均通过，校验命中"看水"情境
    r2.lines.some((l) => l.includes('来看水') || l.includes('看看水') || l.includes('爷爷还在的时候')),
    JSON.stringify(r2.lines?.slice(0, 3)));
  await skipDialogue();

  // R4 当天已触发 → 重进不重复
  await page.evaluate(() => {
    const g = window.__game;
    const cur = g.scene.getScenes(true)[0];
    if (cur) g.scene.stop(cur.scene.key);
    g.scene.start('qinghe_river', { spawn: { x: 24 * 16, y: 3 * 16 } });
  });
  await sleep(2500);
  const r4 = await xiyaState();
  check('R4 当天已触发 → 重进不重复出现', !r4.sprite, JSON.stringify(r4));

  // R3 18:00 后（换天）进河畔 → 夏雅不在
  await page.evaluate(async () => {
    const ts = await import('/src/data/TimeSystem.ts');
    ts.setTimeFull(3, 17, 0);
  });
  await sleep(300);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('qinghe_river');
    if (s) { s.riversideXiyaDay = 0; s.clearRiversideXiya?.(); }
  });
  await page.evaluate(() => window.debug.setTime(18, 30));
  await sleep(500);
  // 重进场景按新时间重建
  await page.evaluate(() => { const g = window.__game; const cur = g.scene.getScenes(true)[0]; if (cur) g.scene.stop(cur.scene.key); g.scene.start('qinghe_river'); });
  await sleep(2500);
  const r3 = await xiyaState();
  check('R3 18:30 河畔夏雅不在（已回农场）', !r3.sprite, JSON.stringify(r3));

  // R5 无运行时错误
  check('R5 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-riverside-xiya 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-riverside-xiya 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
