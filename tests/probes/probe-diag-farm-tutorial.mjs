/**
 * 诊断探针：农场教程浇水段卡 2/3 复现（2026-08-28）
 *
 * 背景：probe-full-story-run 浇水×3 后 step 卡 water_crops（截图 05 显示「→ 浇水 2/3」）。
 * 本探针复现锄地/播种/浇水三段，每发交互后 dump：
 *   - step / 时间 / 体力 / 种子数 / 水壶数
 *   - 田区格状态分布（empty/tilled/planted/watered，debug.farm.getTileState 逐格扫）
 * 只诊断不写断言，定位哪发交互哪格失败。
 * 前置：Vite dev server 在 localhost:5173
 * 运行：node tests/probes/probe-diag-farm-tutorial.mjs
 */

import puppeteer from 'puppeteer-core';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/?reset=1';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function safeEval(page, fn, arg, retries = 6) {
  for (let i = 0; i < retries; i++) {
    try {
      return await page.evaluate(fn, arg);
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(300);
    }
  }
  return undefined;
}

async function teleport(page, sceneKey, x, y, facing = 'up') {
  await page.evaluate(([k, px, py, f]) => {
    const s = window.__game.scene.getScene(k);
    if (!s?.player) return;
    s.player.x = px;
    s.player.y = py;
    s.player.facing = f;
  }, [sceneKey, x, y, facing]);
  await sleep(200);
}

async function pressInteract(page) {
  await page.evaluate(() => {
    const b = document.querySelector('#touch-controls [data-action="interact"]');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(500);
}

async function pressBackpack(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#touch-controls div')];
    const b = btns.find(x => x.textContent?.trim() === '背包');
    if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
  await sleep(500);
}

async function drainAutoDialogue(page, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const open = await safeEval(page, () => {
      const s = window.__game.scene.getScenes(true)[0];
      return s?.storyDialogue?.isOpen?.() ?? false;
    });
    if (!open) return true;
    await safeEval(page, () => {
      const s = window.__game.scene.getScenes(true)[0];
      if (s?.storyDialogue?.isOpen()) s.storyDialogue.advance();
    });
    await sleep(80);
  }
  return false;
}

async function walkDialogue(page, maxLines = 45) {
  await sleep(600);
  const lines = [];
  for (let i = 0; i < maxLines; i++) {
    await safeEval(page, () => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (d?.isOpen() && d.typing) d.advance();
    });
    await sleep(120);
    const cur = await safeEval(page, () => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (!d?.isOpen()) return null;
      const l = d.lines[d.index];
      return l ? { speaker: l.speaker ?? '', text: l.text ?? '', options: l.options } : null;
    });
    if (!cur) break;
    lines.push(cur);
    if (cur.options?.length) break;
    const before = await safeEval(page, () => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (!d) return null;
      return { index: d.index, linesId: d.lines, isOpen: d.isOpen() };
    });
    if (!before) break;
    await safeEval(page, () => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (d?.isOpen()) d.advance();
    });
    await sleep(180);
    const after = await safeEval(page, () => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (!d) return null;
      return { index: d.index, linesId: d.lines, isOpen: d.isOpen() };
    });
    if (!after) break;
    const progressed =
      after.index !== before.index ||
      after.linesId !== before.linesId ||
      after.isOpen !== before.isOpen;
    if (!progressed) break;
    if (!after.isOpen) break;
  }
  await sleep(250);
  return lines;
}

async function clickOption(page, keyword) {
  await page.evaluate((kw) => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(kw));
    if (btn) btn.click();
  }, keyword);
  await sleep(700);
}

async function dismissOverlays(page) {
  for (let round = 0; round < 3; round++) {
    let closedAny = false;
    for (let i = 0; i < 25; i++) {
      const hit = await page.evaluate(() => {
        const layers = [...document.querySelectorAll('div')].filter(d =>
          Number(d.style?.zIndex) >= 600 && d.style?.display !== 'none');
        if (layers.length === 0) return 'none';
        return { w: window.innerWidth / 2, h: window.innerHeight / 2 };
      });
      if (hit === 'none') break;
      await page.mouse.click(hit.w, hit.h);
      await sleep(700);
      closedAny = true;
    }
    if (!closedAny) break;
  }
  await sleep(600);
}

/** 田区格状态扫描 + 关键状态 dump（col 8-24, row 6-16 覆盖教程田区） */
async function dump(page, tag) {
  return page.evaluate((t) => {
    const d = window.debug;
    const counts = {};
    const nonEmpty = [];
    for (let col = 8; col <= 24; col++) {
      for (let row = 6; row <= 16; row++) {
        try {
          const st = d.farm.getTileState(col, row);
          if (st && st !== 'none') {
            counts[st] = (counts[st] ?? 0) + 1;
            if (st !== 'empty') nonEmpty.push(`${col},${row}:${st}`);
          }
        } catch { /* 越界忽略 */ }
      }
    }
    return {
      tag: t,
      step: d.getStoryStep(),
      time: d.getTimeStr(),
      stamina: d.getStamina(),
      seeds: d.getItemCount('radish_seed'),
      can: d.getItemCount('old_watering_can'),
      dialogueOpen: (() => {
        try {
          const s = window.__game.scene.getScenes(true)[0];
          return s?.storyDialogue?.isOpen?.() ?? false;
        } catch { return '?'; }
      })(),
      counts,
      nonEmpty,
    };
  }, tag);
}

async function run() {
  console.log('=== 诊断：农场教程浇水段卡 2/3 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));
  try {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(2500);
    await page.keyboard.press('Enter');
    await sleep(3000);
    await dismissOverlays(page);
    const open = await safeEval(page, () => {
      const s = window.__game.scene.getScenes(true)[0];
      return s?.storyDialogue?.isOpen?.() ?? false;
    });
    if (!open) await sleep(1500);
    await walkDialogue(page);
    await clickOption(page, '现在就走吗');
    await walkDialogue(page, 5);
    await sleep(500);
    await teleport(page, 'station', 1180, 460, 'right');
    await sleep(3500);
    await teleport(page, 'gate', 248, 204, 'up');
    await pressInteract(page);
    await walkDialogue(page);
    await pressBackpack(page);
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-action="use-key"]');
      if (btn) btn.click();
    });
    await walkDialogue(page);
    await teleport(page, 'gate', 240, 40, 'up');
    await sleep(3000);
    console.log('── 进入农场 ──');
    console.log(JSON.stringify(await dump(page, '进农场'), null, 1));

    const plotSpots = [[216, 184], [232, 184], [248, 184]];
    for (let i = 0; i < plotSpots.length; i++) {
      await teleport(page, 'farm', plotSpots[i][0], plotSpots[i][1], 'up');
      await pressInteract(page);
      console.log(`── 锄地 第${i + 1}发 (${plotSpots[i][0]},${plotSpots[i][1]}) ──`);
      console.log(JSON.stringify(await dump(page, `锄${i + 1}`), null, 1));
    }
    console.log('── 锄地段对白 walk ──');
    const sowLines = await walkDialogue(page);
    console.log(`sowLines=${sowLines.length}`, JSON.stringify(await dump(page, '锄后walk'), null, 1));

    for (let i = 0; i < plotSpots.length; i++) {
      await teleport(page, 'farm', plotSpots[i][0], plotSpots[i][1], 'up');
      await pressInteract(page);
      console.log(`── 播种 第${i + 1}发 (${plotSpots[i][0]},${plotSpots[i][1]}) ──`);
      console.log(JSON.stringify(await dump(page, `播${i + 1}`), null, 1));
    }
    console.log('── 播种段对白 walk ──');
    const waterLines = await walkDialogue(page);
    console.log(`waterLines=${waterLines.length}`, JSON.stringify(await dump(page, '播后walk'), null, 1));

    for (let i = 0; i < plotSpots.length; i++) {
      await teleport(page, 'farm', plotSpots[i][0], plotSpots[i][1], 'up');
      await pressInteract(page);
      console.log(`── 浇水 第${i + 1}发 (${plotSpots[i][0]},${plotSpots[i][1]}) ──`);
      console.log(JSON.stringify(await dump(page, `浇${i + 1}`), null, 1));
    }
    console.log('── 浇水段对白 walk ──');
    const eveningLines = await walkDialogue(page);
    console.log(`eveningLines=${eveningLines.length}`, JSON.stringify(await dump(page, '浇后walk'), null, 1));
  } finally {
    await browser.close();
  }
}

run().catch(e => { console.error('❌ 探针异常:', e.message); process.exit(1); });
