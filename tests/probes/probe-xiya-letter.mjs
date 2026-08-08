/**
 * D-011 夏雅《春深有信·一》剧情专线（2026-08-08 制作人拍板）—— 运行时验证探针
 *
 * 验证（Level 2）：
 *   A 开场：花田边生成剧情夏雅 → 按 E → 开场对白（夕阳田埂）→ asked 入档 → 夏雅离开、花苗标记生成
 *   B 互动一：花苗交互 → 整理花苗对白 → 记录标记生成
 *   C 互动二：记录交互 → 旧花种记录对白 + 记忆 moment → 夏雅回来（收尾）
 *   D 收尾：夏雅交互 → 态度变化 + 春祭/烟花伏笔 → done 入档 → 全部清理
 *   E 任务面板：《春深有信·一》显示已完成
 *   F 读档恢复中间态（stage1）：花苗标记恢复、不重复开场、可继续 B
 *   G 完成后重进：不触发不生成
 *   H 全程无运行时错误
 *
 * 前置：dev server；node tests/probes/probe-xiya-letter.mjs
 * 说明：存档构造 restore.garden=true（花园已恢复），避免花园恢复交互/gardenXiya 干扰；
 *       时段 hour=16 满足 12:00<=hour<20:00 触发窗口。
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
// 剧情夏雅（花田边 col28,row5）/(花苗标记 col30,row5)/(记录标记 中心右上)
const XIYA_POS = { x: 28 * T + T / 2, y: 5 * T + T / 2 };
const FLOWER_POS = { x: 30 * T + T / 2, y: 5 * T + T / 2 };
const RECORD_POS = { x: 30 * T + T / 2 - 16, y: 5 * T + T / 2 - 12 };

const makeSave = (x, y, mapFlags = {}, hour = 16) => ({
  version: '0.5', savedAt: 'xiya-letter-probe', timestamp: Date.now(),
  player: { x, y, scene: 'farm', facing: 'down', inventory: {} },
  world: { day: 1, hour, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true } },
  story: { storyStep: 'done' },
  // 花园已恢复：需同时将「院子有人照顾」（旧藤架支线）置完成态，否则其锚点（花田中心）会劫持本探针的按 E
  mapFlags: { sideXiyaGardenAsked: true, sideXiyaGardenDone: true, ...mapFlags },
});

async function run() {
  console.log('=== D-011 夏雅《春深有信·一》剧情专线运行时验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  const flags = () => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('return_star_save') || 'null');
    return s ? (s.mapFlags || {}) : {};
  });
  const bodyText = () => page.evaluate(() => document.body.innerText);
  const sceneState = () => page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    const s = g.scene.getScenes(true)[0];
    return {
      key: s?.scene?.key ?? 'none',
      xiya: !!s?.letterXiya,
      flower: !!s?.letterFlowerMark,
      record: !!s?.letterRecordMark,
    };
  });
  const movePlayer = (x, y) => page.evaluate(([px, py]) => {
    const s = window.__game.scene.getScenes(true)[0];
    s.player.x = px; s.player.y = py;
  }, [x, y]);

  const enterGame = async (scene, timeoutMs = 20000) => {
    const t0 = Date.now();
    let cur = '';
    while (Date.now() - t0 < timeoutMs) {
      cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (cur === scene) return;
      if (cur === 'title') {
        await page.keyboard.press('Enter');
        await page.mouse.click(400, 300);
      }
      await sleep(350);
    }
    throw new Error(`未能进入场景 ${scene}（实际 ${cur}）错误=${errors.slice(0, 5).join(' | ')}`);
  };

  const gotoScene = async (saveObj) => {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), saveObj);
    await page.reload({ waitUntil: 'networkidle2' });
    await enterGame('farm');
    await sleep(1000);
  };

  /** 按 E 触发一次（不推进对话） */
  const pressE = async () => {
    await page.keyboard.press('KeyE');
    await sleep(500);
  };

  /** 推进当前对白直到 watchStrs 全部出现或超时；返回是否全部出现 */
  const advanceUntilSeen = async (watchStrs, timeoutMs = 25000) => {
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const b = await bodyText();
      for (const s of watchStrs) if (b.includes(s)) seen.add(s);
      if (watchStrs.every((s) => seen.has(s))) break;
      await page.keyboard.press('Enter');
      await page.mouse.click(400, 300);
      await sleep(350);
    }
    return { allSeen: watchStrs.every((s) => seen.has(s)), seen: [...seen] };
  };

  /** 推进到对话完全结束（回调入档/生成完成） */
  const drainDialogue = async (pred, timeoutMs = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await pred()) return true;
      await page.keyboard.press('Enter');
      await page.mouse.click(400, 300);
      await sleep(300);
    }
    return false;
  };

  // ============ A 段：开场 ============
  console.log('--- A 开场（花田边剧情夏雅）---');
  await gotoScene(makeSave(XIYA_POS.x, XIYA_POS.y));
  await sleep(800);
  let st = await sceneState();
  check('A0 剧情夏雅已在花田边生成', st.key === 'farm' && st.xiya === true, JSON.stringify(st));

  await pressE();
  let a = await advanceUntilSeen(['夕阳落在田埂上', '你只是刚好回来了']);
  check('A1 开场演出+对白出现', a.allSeen, JSON.stringify(a.seen));
  check('A2 开场入档（asked）', await drainDialogue(async () => (await flags()).xiyaLetterAsked === true), JSON.stringify(await flags()));
  // 等开场对白完全结束（回调：夏雅离开 + 花苗标记生成）
  check('A3 开场后夏雅离开、花苗标记生成', await drainDialogue(async () => {
    const s = await sceneState();
    return s.flower === true && s.xiya === false;
  }), JSON.stringify(await sceneState()));

  // ============ B 段：整理花苗 ============
  console.log('\n--- B 互动一（花苗）---');
  await movePlayer(FLOWER_POS.x, FLOWER_POS.y);
  await pressE();
  let b = await advanceUntilSeen(['快的话，几天', '它只是按照自己的时间长出']);
  check('B1 整理花苗对白出现', b.allSeen, JSON.stringify(b.seen));
  check('B2 花苗交互完成（记录标记生成）', await drainDialogue(async () => (await sceneState()).record === true), JSON.stringify(await sceneState()));

  // ============ C 段：旧花种记录 ============
  console.log('\n--- C 互动二（旧花种记录）---');
  await movePlayer(RECORD_POS.x, RECORD_POS.y);
  await pressE();
  let c = await advanceUntilSeen(['失败也算种过', '旧花种记录']);
  check('C1 记录对白 + 记忆 moment 出现', c.allSeen, JSON.stringify(c.seen));
  check('C2 记录交互完成（夏雅回来收尾）', await drainDialogue(async () => (await sceneState()).xiya === true), JSON.stringify(await sceneState()));

  // ============ D 段：收尾埋伏笔 ============
  console.log('\n--- D 收尾（态度变化 + 春祭/烟花伏笔）---');
  await movePlayer(XIYA_POS.x, XIYA_POS.y);
  await pressE();
  let d = await advanceUntilSeen(['下周岛上有个小活动', '到时候你就知道了']);
  check('D1 收尾对白 + 春祭/烟花伏笔出现', d.allSeen, JSON.stringify(d.seen));
  check('D2 完成入档（done）', await drainDialogue(async () => (await flags()).xiyaLetterDone === true), JSON.stringify(await flags()));
  // 等收尾对白完全结束（回调：清理全部交互对象）
  check('D3 完成后夏雅与交互点全部清理', await drainDialogue(async () => {
    const s = await sceneState();
    return s.xiya === false && s.flower === false && s.record === false;
  }), JSON.stringify(await sceneState()));

  // ============ E 段：任务面板 ============
  console.log('\n--- E 任务面板（完成态）---');
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    s.questPanel?.open?.();
    document.querySelector('#quest-panel [data-tab="side"]')?.click();
  });
  await sleep(500);
  const qBody = await page.evaluate(() => document.getElementById('quest-panel')?.querySelector('#qp-body')?.textContent ?? '');
  check('E1 《春深有信·一》在支线列表且已完成', qBody.includes('春深有信·一') && qBody.includes('已完成'),
    qBody.replace(/\s+/g, ' ').slice(0, 100));

  // ============ F 段：读档恢复中间态（stage1） ============
  console.log('\n--- F 读档恢复（stage1：花苗标记）---');
  await gotoScene(makeSave(FLOWER_POS.x, FLOWER_POS.y, { xiyaLetterAsked: true, xiyaLetterStage: 1 }));
  await sleep(800);
  st = await sceneState();
  check('F1 读档 stage1：恢复花苗标记、无夏雅', st.flower === true && st.xiya === false, JSON.stringify(st));
  await pressE();
  await sleep(500);
  const fBody = await bodyText();
  check('F2 读档 stage1：不重复开场对白', !fBody.includes('夕阳落在田埂上'), '');
  let b2 = await advanceUntilSeen(['快的话，几天']);
  check('F3 读档 stage1：花苗交互可继续', b2.allSeen, JSON.stringify(b2.seen));

  // ============ G 段：完成后重进 ============
  console.log('\n--- G 完成后重进（不触发不生成）---');
  await gotoScene(makeSave(XIYA_POS.x, XIYA_POS.y, { xiyaLetterAsked: true, xiyaLetterDone: true, xiyaLetterStage: 4 }));
  await sleep(800);
  st = await sceneState();
  check('G1 完成后重进：无夏雅/无交互点', st.xiya === false && st.flower === false && st.record === false, JSON.stringify(st));
  await pressE();
  await sleep(500);
  const gBody = await bodyText();
  check('G2 完成后按 E 不触发春深有信相关对白',
    !gBody.includes('夕阳落在田埂上') && !gBody.includes('下周岛上有个小活动') && !gBody.includes('失败也算种过'), '');

  // ============ H 段：运行时错误 ============
  check('\nH1 无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log(`\n========== 结果: ✅ ${pass} 通过 / ❌ ${fail} 失败 ==========`);
  if (fail > 0) process.exitCode = 1;
  await browser.close();
}

run().catch((err) => { console.error('探针异常:', err); process.exit(1); });
