/**
 * 农场西侧缺口"石墙堵住"验证探针（2026-08-11 制作人反馈"灯塔影子效果不好"后重写）
 *
 * 背景：08-10 灯塔预埋方案把 farm 西侧石墙打通为海湾缺口 + 海面/沙滩/灯塔远景剪影；
 *       08-11 制作人反馈灯塔剪影效果不好 → 缺口用石墙堵回（farm.json Walls 层
 *       rows 10-13/col0 恢复 gid 3），setupFarmWestCoast 撤除，灯塔不可见。
 *       未来开放时移除 locked + 打通石墙 + 重建海湾（见 docs/design/灯塔未来内容预埋方案-v1.0.md）。
 *
 * 验证（Level 2）：
 *   1. 白天：西侧缺口区域（x 0-40, y 144-224）无海色/无灯塔剪影色（蓝色主导像素占比 <8%）
 *   2. 碰撞：玩家向左走被石墙挡在 x≥16（不再有"海墙挡 x≥40"，石墙在 col0=x 0-16）
 *   3. 夜晚（scene.restart 重建）：同样区域仍无夜晚海色；出口仍 locked（站触发区不切换）
 *   4. 截图归档：白天西侧 / 夜晚西侧 2 张
 *
 * 用法：dev server（建议独立端口，避免并行会话 HMR 抖动——见 memory 08-10 教训）；
 *       GAME_URL=http://localhost:5199 node tests/probes/probe-farm-west-coast-visual.mjs
 * 视口：横屏 1024×768（项目手机端只支持横屏，禁止竖屏视口——probe-farm-tap 教训）
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

const makeSave = () => JSON.stringify({
  version: '0.5', savedAt: 'farm-west-probe', timestamp: Date.now(),
  player: { x: 120, y: 176, scene: 'farm', facing: 'left', inventory: {} },
  world: { day: 2, hour: 9, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'done' },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true } },
  worldRestore: {},
  story: { storyStep: 'done' },
  mapFlags: {},
  gameState: { triggeredEvents: {} },
});

async function run() {
  console.log('=== 农场西侧缺口"石墙堵住"实机验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let fails = 0;
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails++;
  };

  const playerState = () => page.evaluate(() => {
    const g = window.__game;
    if (!g?.scene) return null;
    const s = g.scene.getScenes(true).find((x) => x.player) || g.scene.getScenes(true)[0];
    const p = s?.player;
    return { key: s?.scene?.key ?? 'none', x: p ? Math.round(p.x) : -1, y: p ? Math.round(p.y) : -1 };
  });
  const waitScene = async (key, timeoutMs = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const st = await playerState();
      if (st && st.key === key) return st;
      await sleep(300);
    }
    const st = await playerState();
    throw new Error(`未能进入场景 ${key}（实际 ${st?.key}）`);
  };

  // 像素分析：西侧缺口区域 (0-40, 144-224) 中"蓝色主导"像素占比（海/塔剪影均为蓝系，石墙/草地不是）
  // WebGL canvas 不能直接 getContext('2d')，用 2D canvas drawImage 中转读取
  const blueRatio = () => page.evaluate(() => {
    const src = document.querySelector('canvas');
    if (!src) return -1;
    const c2 = document.createElement('canvas');
    c2.width = src.width; c2.height = src.height;
    const ctx = c2.getContext('2d');
    if (!ctx) return -1;
    ctx.drawImage(src, 0, 0);
    const { data } = ctx.getImageData(0, 144, 40, 80);
    let blue = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 200) continue;
      total++;
      // 蓝色主导：b 显著高于 r 和 g（海 0x2a5a7a=(42,90,122) / 夜海 0x0a1a2a=(10,26,42) / 塔 0x2e3c4e=(46,60,78) 均满足）
      if (b > r + 25 && b > g + 15) blue++;
    }
    return total === 0 ? -1 : blue / total;
  });

  try {
    // 种子存档直达 farm（白天 9:00）
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await page.evaluate((save) => localStorage.setItem('return_star_save', save), makeSave());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.evaluate(() => {
      window.debug.setStoryStep('done');
      window.debug.setQuestState('completed');
      window.debug.setTime(9, 0);
    });
    await page.keyboard.press('Enter');
    await sleep(500);
    await waitScene('farm');
    await sleep(1500);

    // 1) 白天截图 + 西侧区域无海/塔蓝色
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      s.player.setPosition(120, 176); s.player.facing = 'left';
    });
    await sleep(1200);
    await page.screenshot({ path: join(SHOT_DIR, 'farm-west-wall-day.png') });
    console.log(`📸 ${join(SHOT_DIR, 'farm-west-wall-day.png')}`);
    const blueDay = await blueRatio();
    check('白天西侧缺口无海色/灯塔剪影（蓝占比<8%）', blueDay >= 0 && blueDay < 0.08, `蓝占比=${(blueDay * 100).toFixed(1)}%`);

    // 2) 碰撞：向左走 2s，应被石墙挡在 x≥16（石墙 col0 = x 0-16）
    const beforeX = await page.evaluate(() => window.__game.scene.getScene('farm').player.x);
    await page.keyboard.down('ArrowLeft');
    await sleep(2000);
    await page.keyboard.up('ArrowLeft');
    await sleep(400);
    const afterX = await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      return { x: Math.round(s.player.x), y: Math.round(s.player.y) };
    });
    console.log(`碰撞: 起点 x=${beforeX.toFixed(1)} → 终点 x=${afterX.x} y=${afterX.y}`);
    check('向左移动了一段', afterX.x < beforeX - 10, `-${(beforeX - afterX.x).toFixed(1)}px`);
    check('被石墙挡在 x≥16（不穿墙）', afterX.x >= 16 && afterX.x <= 48, `x=${afterX.x}`);

    // 3) 夜晚：置 21:00 并重启场景
    await page.evaluate(() => {
      window.debug.setTime(21, 0);
      const s = window.__game.scene.getScene('farm');
      s.scene.restart();
    });
    await sleep(2500);
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      s.player.setPosition(120, 176); s.player.facing = 'left';
    });
    await sleep(1000);
    await page.screenshot({ path: join(SHOT_DIR, 'farm-west-wall-night.png') });
    console.log(`📸 ${join(SHOT_DIR, 'farm-west-wall-night.png')}`);
    const blueNight = await blueRatio();
    check('夜晚西侧缺口无夜海色（蓝占比<8%）', blueNight >= 0 && blueNight < 0.08, `蓝占比=${(blueNight * 100).toFixed(1)}%`);

    // 4) 夜晚出口仍 locked：站触发区 (36-64,160-208) 不被吸入
    await page.evaluate(([x, y]) => {
      const g = window.__game;
      const s = g.scene.getScenes(true).find((sc) => sc.player);
      s.player.setPosition(x, y);
    }, [50, 176]);
    await sleep(2500);
    const stF = await playerState();
    check('夜晚出口仍 locked（灯塔不可进入）', stF.key === 'farm', `player=(${stF.x},${stF.y})`);

    const realErrors = errors.filter(e => !e.includes('favicon'));
    check('无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

    console.log(`\n${fails === 0 ? '🎉 全部通过' : `⚠️ ${fails} 项失败`}`);
  } finally {
    await browser.close();
  }
  process.exit(fails === 0 ? 0 : 1);
}

run().catch(err => { console.error('探针异常:', err.message); process.exit(1); });
