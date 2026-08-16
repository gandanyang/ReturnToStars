/**
 * probe-hud-menu.mjs — HUD 功能菜单（移动端优先收纳）验收
 *
 * 验证（2026-08-16）：
 *   M1 HUD「☰」菜单入口存在
 *   M2 点击入口 → 菜单打开，包含归星录/自然记录/声音条目
 *   M3 点击「归星录」→ 相簿面板打开，菜单关闭
 *   M4 点击「自然记录」→ 图鉴面板打开，菜单关闭
 *   M5 再次打开菜单 → 声音条目存在（开关项）
 *   M6 Esc 关闭菜单（未选择任何条目时）
 *   M7 无运行时错误
 *
 * 运行：node tests/probes/probe-hud-menu.mjs
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
    version: '0.5', savedAt: 'hud-menu', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 2, hour: 9, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [], questState: 'completed' },
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

/** 打开菜单并返回状态 */
async function openMenu() {
  await page.evaluate(() => {
    const btn = document.getElementById('hud-menu-btn');
    if (btn) btn.click();
  });
  await sleep(400);
  return page.evaluate(() => {
    const panel = document.getElementById('hud-menu-panel');
    const list = document.getElementById('hud-menu-list');
    return { open: !!panel && panel.style.display !== 'none', text: list?.textContent ?? '' };
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
  await sleep(1500);
  await skipDialogue();

  // M1 入口存在
  const btnExists = await page.evaluate(() => !!document.getElementById('hud-menu-btn'));
  check('M1 HUD「☰」菜单入口存在', btnExists, '');

  // M2 打开菜单 → 包含条目
  const m2 = await openMenu();
  check('M2 菜单打开且包含归星录/自然记录/声音',
    m2.open && m2.text.includes('归星录') && m2.text.includes('自然记录') && m2.text.includes('声音'),
    m2.text.slice(0, 160));

  // M3 点「归星录」→ 相簿打开
  await page.evaluate(() => {
    const row = document.querySelector('[data-menu-item="album"]');
    if (row) row.click();
  });
  await sleep(500);
  const m3 = await page.evaluate(() => {
    const album = document.getElementById('photo-album-panel');
    const menu = document.getElementById('hud-menu-panel');
    return { albumOpen: !!album && album.style.display !== 'none', menuOpen: !!menu && menu.style.display !== 'none' };
  });
  check('M3 点击归星录 → 相簿打开且菜单关闭', m3.albumOpen && !m3.menuOpen, JSON.stringify(m3));
  await page.keyboard.press('Escape');
  await sleep(300);

  // M4 点「自然记录」→ 图鉴打开
  await openMenu();
  await page.evaluate(() => {
    const row = document.querySelector('[data-menu-item="discovery"]');
    if (row) row.click();
  });
  await sleep(500);
  const m4 = await page.evaluate(() => {
    const d = document.getElementById('discovery-panel');
    const menu = document.getElementById('hud-menu-panel');
    return { discOpen: !!d && d.style.display !== 'none', menuOpen: !!menu && menu.style.display !== 'none' };
  });
  check('M4 点击自然记录 → 图鉴打开且菜单关闭', m4.discOpen && !m4.menuOpen, JSON.stringify(m4));
  await page.keyboard.press('Escape');
  await sleep(300);

  // M5 再开菜单 → 声音条目（开关项）
  const m5 = await openMenu();
  check('M5 菜单含声音开关条目', m5.open && m5.text.includes('声音'), m5.text.slice(0, 120));

  // M6 Esc 关闭
  await page.keyboard.press('Escape');
  await sleep(300);
  const m6 = await page.evaluate(() => {
    const menu = document.getElementById('hud-menu-panel');
    return !menu || menu.style.display === 'none';
  });
  check('M6 Esc 关闭菜单', m6, '');

  // M7 无运行时错误
  check('M7 无运行时错误', errors.filter((e) => !/favicon|404/.test(e)).length === 0,
    errors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-hud-menu 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
  console.log(`\n===== probe-hud-menu 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
