/**
 * P0-5 农场回暖 前后对比截图（2026-08-09 制作人交付物）
 *
 * before：无 farmWarm 存档进 farm（questState=not_started）—— 荒凉色调
 * after ：有 farmWarm 存档进 farm（questState=completed + worldRestore.farmWarm）—— 暖橙 overlay + 光尘
 *
 * 同一视口（1024×768）、同一出生点、同一等待时长，保证对比公平。
 * 每个状态连拍 3 张（间隔 600ms），捕捉光尘粒子动态。
 * 输出：tests/probes/test-screenshots/p0-5/
 *
 * 用法：node tests/probes/probe-farm-warm-shot.mjs
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'test-screenshots', 'p0-5');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });

const T = 16;
const FARM_POS = { x: 20 * T + T / 2, y: 10 * T + T / 2 }; // 同 probe-farm-warm

const makeSave = (scene, x, y, { questState = 'not_started', worldRestore = {}, gameState = {}, hour = 9 } = {}) => ({
  version: '0.5', savedAt: 'farm-warm-shot', timestamp: Date.now(),
  player: { x, y, scene, facing: 'down', inventory: {} },
  world: { day: 2, hour, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true } },
  worldRestore,
  story: { storyStep: 'done' },
  mapFlags: { sideXiyaGardenAsked: true, sideXiyaGardenDone: true },
  gameState: { triggeredEvents: {
    first_morning_response: true, adventurer_welcome_back: true, carpenter_returned: true,
    ...gameState.triggeredEvents,
  } },
});

async function run() {
  console.log('=== P0-5 农场回暖 前后对比截图 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // 需 GPU/WebGL，与真机 WebView 渲染链路一致（headless --disable-gpu 下 ADD blend 不生效）
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const enterGame = async (timeoutMs = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (cur === 'farm') return;
      if (cur === 'title') {
        await page.keyboard.press('Enter');
        await page.mouse.click(400, 300);
      }
      await sleep(350);
    }
    throw new Error(`未能进入 farm（错误=${errors.slice(0, 5).join(' | ')}）`);
  };

  const closeOverlays = () => page.evaluate(() => {
    const s = window.__game?.scene?.getScenes?.(true)?.[0];
    try { s?.storyDialogue?.close?.(); } catch {}
    try { s?.storyDialogue?.reset?.(); } catch {}
    document.querySelectorAll('[id*="memory"], [class*="memory-moment"]').forEach((el) => {
      el.style.display = 'none'; el.style.opacity = '0';
    });
    document.getElementById('dialogue-history')?.remove?.();
  });

  const snap = async (label) => {
    await closeOverlays();
    await sleep(200);
    for (let i = 1; i <= 3; i++) {
      const path = join(OUT, `${label}-${i}.png`);
      await page.screenshot({ path });
      console.log(`📸 ${label}-${i}.png`);
      await sleep(600);
    }
  };

  const stateInfo = async () => page.evaluate(() => {
    const s = window.__game?.scene.getScenes(true)[0];
    const dbg = s?.farmController?.getWarmDebugState?.();
    // 画布中心采样（截图前 overlay 应生效，暖色下 R/B 应提升）
    const canvas = document.querySelector('canvas');
    let sample = 'n/a';
    if (canvas && canvas.getContext) {
      try {
        const ctx = canvas.getContext('2d');
        const d = ctx.getImageData(512, 384, 1, 1).data;
        sample = `rgba(${d[0]},${d[1]},${d[2]})`;
      } catch (e) { sample = 'read-failed'; }
    }
    return {
      warmOverlay: dbg?.active ?? false,
      overlayAlpha: dbg?.alpha ?? -1,
      warmParticles: dbg?.particleCount ?? 0,
      centerSample: sample,
    };
  });

  // ---------- before：未交付（无 farmWarm） ----------
  console.log('--- before：未交付进 farm ---');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await sleep(1200);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)),
    makeSave('farm', FARM_POS.x, FARM_POS.y, { questState: 'not_started' }));
  await page.reload({ waitUntil: 'networkidle2' });
  await enterGame();
  await sleep(6000); // 渲染稳定
  console.log('state:', JSON.stringify(await stateInfo()));
  await snap('p0-5-before');

  // ---------- after：交付后（farmWarm） ----------
  console.log('\n--- after：交付后进 farm（回暖） ---');
  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await sleep(1200);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)),
    makeSave('farm', FARM_POS.x, FARM_POS.y, {
      questState: 'completed',
      worldRestore: { farmWarm: true },
    }));
  await page.reload({ waitUntil: 'networkidle2' });
  await enterGame();
  await sleep(6000); // 等 5s 过渡完成，alpha=0.1
  console.log('state:', JSON.stringify(await stateInfo()));
  await snap('p0-5-after');

  console.log('\n错误数:', errors.length, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log('\n截图目录:', OUT);
}

run().catch((e) => { console.error('截图异常:', e); process.exit(1); });
