/**
 * 农场北侧出口树挪位探针（2026-08-09）
 *
 * 背景：col15,row2 原位于森林出口通道（col14-16,rows0-2）正中挡路 → 挪至 col18,row2。
 *
 * 验证：
 *   1. 新档进 farm：(18,2) 有树精灵、(15,2) 无；树中心 (296,40)
 *   2. 旧档迁移：存档 trees 含 ["15,2", {isStump:true}] → 重进后 (18,2) 为树桩、(15,2) 不存在
 *   3. 无运行时错误
 *
 * 前置：dev server（5173）；node tests/probes/probe-move-tree.mjs
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

mkdirSync(SHOT_DIR, { recursive: true });

/** 读取树木精灵状态 */
const SNAP_TREES = `(() => {
  const s = window.__game?.scene.getScene('farm');
  if (!s) return { sceneLoaded: false };
  const out = { sceneLoaded: true, sprites: {} };
  for (const [key, sp] of s.treeSprites) {
    out.sprites[key] = {
      tex: sp.texture.key,
      x: Math.round(sp.x), y: Math.round(sp.y),
      visible: sp.visible,
      bodyEnabled: !!(sp.body && sp.body.enable),
    };
  }
  return out;
})()`;

async function run() {
  console.log('=== 农场北侧出口树挪位验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  /** 写存档 → 刷新 → 进入 farm */
  const loadFarmWithSave = async (saveObj) => {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.evaluate((sv) => {
      localStorage.setItem('return_star_save', JSON.stringify(sv));
    }, saveObj);
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1000);
    let scene = '';
    for (let i = 0; i < 50; i++) {
      await sleep(300);
      scene = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (scene === 'farm') break;
      if (scene === 'title') {
        await page.keyboard.press('Enter');
        await page.mouse.click(400, 300);
      }
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find(d => d.textContent?.includes('建议打开声音游玩'));
        if (el) { el.click(); return true; }
        return false;
      });
    }
    if (scene !== 'farm') throw new Error('未能进入农场场景');
    await sleep(1200);
  };

  const baseSave = {
    version: '0.5', savedAt: 'move-tree探针', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 1, hour: 9, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done' },
  };

  try {
    // 1. 新档：树已挪到 (18,2)，原 (15,2) 不再有树
    await loadFarmWithSave(baseSave);
    let d = await page.evaluate(SNAP_TREES);
    check('场景可访问', d.sceneLoaded);
    const tree18 = d.sprites['18,2'];
    const tree15 = d.sprites['15,2'];
    check('新档 (18,2) 有树', !!tree18, `实际=${JSON.stringify(d.sprites['18,2'] ?? null)}`);
    check('新档 (15,2) 无树（已挪走）', !tree15, `实际=${JSON.stringify(d.sprites['15,2'] ?? null)}`);
    check('树精灵位置正确 (296,40)', tree18 && tree18.x === 296 && tree18.y === 40, `实际=(${tree18?.x},${tree18?.y})`);
    check('树有碰撞体', tree18 && tree18.bodyEnabled === true, `实际=${tree18?.bodyEnabled}`);
    check('树纹理为 tree1/tree2 之一', tree18 && (tree18.tex === 'tree1' || tree18.tex === 'tree2'), `实际=${tree18?.tex}`);
    try {
      await page.screenshot({ path: join(SHOT_DIR, 'move-tree-new.png') });
      console.log('  📸 move-tree-new.png');
    } catch { /* ignore */ }

    // 2. 旧档迁移：模拟"挪位前保存的旧档"——含全部 26 棵树，其中 (15,2) 已被砍成树桩
    //    → 重进后 (18,2) 应为树桩、原 (15,2) 不再渲染、树桩不挡路
    const posList = [
      { col: 1, row: 2 }, { col: 2, row: 3 }, { col: 3, row: 2 },
      { col: 1, row: 5 }, { col: 3, row: 6 },
      { col: 8, row: 2 }, { col: 15, row: 2 }, { col: 25, row: 2 },
      { col: 32, row: 3 },
      { col: 37, row: 2 }, { col: 38, row: 3 }, { col: 37, row: 5 },
      { col: 1, row: 8 }, { col: 2, row: 12 }, { col: 1, row: 16 },
      { col: 2, row: 20 },
      { col: 39, row: 5 }, { col: 38, row: 10 }, { col: 39, row: 15 },
      { col: 38, row: 19 },
      { col: 3, row: 20 }, { col: 8, row: 21 }, { col: 13, row: 20 },
      { col: 30, row: 21 }, { col: 35, row: 20 }, { col: 39, row: 21 },
    ];
    const oldSave = structuredClone(baseSave);
    oldSave.farm.trees = posList.map(pos => [`${pos.col},${pos.row}`, { col: pos.col, row: pos.row, health: 3, isStump: false }]);
    // 旧档中 (15,2) 是树桩（health 0 / isStump true）
    oldSave.farm.trees = oldSave.farm.trees.filter(([k]) => k !== '15,2');
    oldSave.farm.trees.push(['15,2', { col: 15, row: 2, health: 0, isStump: true, stumpGone: false }]);
    await loadFarmWithSave(oldSave);
    d = await page.evaluate(SNAP_TREES);
    const mig18 = d.sprites['18,2'];
    const mig15 = d.sprites['15,2'];
    check('旧档迁移后 (18,2) 有树/树桩', !!mig18, `实际=${JSON.stringify(d.sprites['18,2'] ?? null)}`);
    check('旧档迁移后 (15,2) 不再渲染', !mig15, `实际=${JSON.stringify(d.sprites['15,2'] ?? null)}`);
    check('迁移保留砍伐状态：树桩纹理', mig18 && mig18.tex === 'stump', `实际=${mig18?.tex}`);
    check('树桩不挡路（body 禁用）', mig18 && mig18.bodyEnabled === false, `实际=${mig18?.bodyEnabled}`);
    try {
      await page.screenshot({ path: join(SHOT_DIR, 'move-tree-migrated-stump.png') });
      console.log('  📸 move-tree-migrated-stump.png');
    } catch { /* ignore */ }

    // 3. 无运行时错误
    check('无 pageerror / console.error', errors.length === 0, `实际=${errors.slice(0, 3).join(' | ')}`);
  } catch (e) {
    console.log('❌ 探针异常: ' + e.message);
    fail++;
  }

  await browser.close();
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
