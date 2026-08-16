/**
 * probe-discovery-panel.mjs — P1 Discovery 图鉴展示（信息展示层）验收
 *
 * 验证（2026-08-16 制作人拍板：图鉴是信息展示层，非收集百分比/奖励）：
 *   D1 HUD「自然记录」入口存在，点击打开面板
 *   D2 未发现条目显示占位 + 轻提示（？？？ + hint）
 *   D3 采集蒲公英后重开面板 → 已发现条目显示名称/地点/天数
 *   D4 雨天采蘑菇 → 特殊发现备注（rain_forest 文案）出现
 *   D5 Esc 关闭面板
 *   D6 无运行时错误
 *
 * 运行：node tests/probes/probe-discovery-panel.mjs
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
    version: '0.5', savedAt: 'discovery-panel', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 2, hour: 11, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [], questState: 'completed' },
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

/** 打开图鉴面板并返回列表文本 */
async function openPanelText() {
  await page.evaluate(() => {
    const btn = document.getElementById('discovery-btn');
    if (btn) btn.click();
  });
  await sleep(400);
  return page.evaluate(() => {
    const panel = document.getElementById('discovery-panel');
    const list = document.getElementById('discovery-list');
    return { open: !!panel && panel.style.display !== 'none', text: list?.textContent ?? '' };
  });
}

/** 在 farm 采集一个未采蒲公英 */
async function gatherDandelion() {
  for (let attempt = 0; attempt < 4; attempt++) {
    await skipDialogue(3000);
    const r = await page.evaluate(async () => {
      const s = window.__game.scene.getScene('farm');
      if (s.storyDialogue?.isOpen?.()) return { blocked: 'dialogue' };
      const node = (s.gatherNodes ?? []).find((n) => !n.collected && n.def.kind === 'dandelion');
      if (!node) return { err: '无蒲公英节点' };
      s.player.x = node.def.x + 4; s.player.y = node.def.y + 2;
      s.checkGatherHint();
      await new Promise((r2) => setTimeout(r2, 150));
      const ret = s.tryGatherInteract();
      await new Promise((r2) => setTimeout(r2, 300));
      return { ret, id: node.def.id };
    });
    if (r.ret === true) return r;
    if (r.err) return r;
    await sleep(500);
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
  await skipDialogue();

  // D1 HUD 入口 + 打开面板
  const btnExists = await page.evaluate(() => !!document.getElementById('discovery-btn'));
  check('D1 HUD「自然记录」入口存在', btnExists, '');
  const p1 = await openPanelText();
  check('D1b 点击入口 → 面板打开', p1.open, JSON.stringify(p1));
  check('D2 未发现条目显示占位+轻提示', p1.text.includes('？？？') && p1.text.includes('下雨天会特别多'),
    p1.text.slice(0, 200));
  // 关闭面板
  await page.keyboard.press('Escape');
  await sleep(300);

  // D3 采集蒲公英后重开 → 已发现
  await gatherDandelion();
  const p2 = await openPanelText();
  check('D3 采集后已发现条目显示名称/地点/天数',
    p2.text.includes('蒲公英') && p2.text.includes('第 2 天') && p2.text.includes('farm'),
    p2.text.slice(0, 240));
  await page.keyboard.press('Escape');
  await sleep(300);

  // D4 雨天采蘑菇 → 特殊发现备注（farm 无蘑菇，需去森林）
  // 简化：直接在森林雨天采集验证（复用世界提示探针的路径）
  await skipDialogue(5000);
  await page.evaluate(async () => {
    const exits = (await import('/src/data/exits.ts')).MAP_EXITS;
    const s = window.__game.scene.getScenes(true)[0];
    const zone = (exits[s.scene.key] ?? []).find((e) => e.target === 'forest');
    if (!zone) throw new Error('无森林出口');
    s.player.x = zone.x + zone.w / 2; s.player.y = zone.y + zone.h / 2;
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const cur = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (cur === 'forest') break;
    await sleep(300);
  }
  await sleep(1500);
  await skipDialogue();
  await page.evaluate(() => window.debug.setTime(12, 0)); // 雨窗内
  await sleep(500);
  for (let attempt = 0; attempt < 4; attempt++) {
    await skipDialogue(3000);
    const r = await page.evaluate(async () => {
      const s = window.__game.scene.getScene('forest');
      if (s.storyDialogue?.isOpen?.()) return false;
      const node = (s.gatherNodes ?? []).find((n) => !n.collected && n.def.kind === 'wild_mushroom');
      if (!node) return false;
      s.player.x = node.def.x + 4; s.player.y = node.def.y + 2;
      s.checkGatherHint();
      await new Promise((r2) => setTimeout(r2, 150));
      return s.tryGatherInteract();
    });
    if (r) break;
    await sleep(500);
  }
  const p3 = await openPanelText();
  check('D4 雨中发现蘑菇 → 特殊备注出现',
    p3.text.includes('野蘑菇') && p3.text.includes('下雨的时候'),
    p3.text.slice(0, 260));

  // D5 Esc 关闭
  await page.keyboard.press('Escape');
  await sleep(300);
  const closed = await page.evaluate(() => {
    const panel = document.getElementById('discovery-panel');
    return !panel || panel.style.display === 'none';
  });
  check('D5 Esc 关闭面板', closed, '');

  // D6 无运行时错误
  check('D6 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-discovery-panel 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-discovery-panel 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
