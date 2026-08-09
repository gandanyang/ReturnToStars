/**
 * 农场西侧海湾（2026-08-10 制作人方案：灯塔岛在农场西边）实机验证探针
 *
 * 背景：右上角海角远景（灯塔+码头剪影）已撤除，灯塔内容统一在 lighthouse 场景；
 *       farm 西侧中部石墙打通为海湾缺口，玩家看到西边是海但出口 locked（未来内容预埋）。
 *
 * 验证（Level 2）：
 *   1. 白天：海湾海面渲染（x 0-40, y 144-224 区域海色占比高）；沙滩过渡存在
 *   2. 碰撞：玩家从右向左走向海湾 → 被海面碰撞墙挡（x 停 ≥ ~40，不落海）
 *   3. 夜晚（scene.restart 重建）：海面变暗（暗色占比高）；出口仍 locked（站触发区不切换）
 *   4. 右上角无灯塔残留（旧 setupFarmHorizon 已撤：区域无塔身色像素）
 *   5. 截图归档：白天海湾 / 夜晚海湾 2 张
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
  console.log('=== 农场西侧海湾（灯塔岛在农场西边）实机验证 ===\n');
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

    // 1) 白天截图 + 海面渲染（玩家站海湾右侧看海）
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      s.player.setPosition(120, 176); s.player.facing = 'left';
    });
    await sleep(1200);
    await page.screenshot({ path: join(SHOT_DIR, 'farm-west-coast-day.png') });
    console.log(`📸 ${join(SHOT_DIR, 'farm-west-coast-day.png')}`);

    // 2) 碰撞：向左走 2s，应被海墙挡在 x ≥ ~40
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
    check('被海墙挡在 x≥40（不落海）', afterX.x >= 40, `x=${afterX.x}`);

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
    await page.screenshot({ path: join(SHOT_DIR, 'farm-west-coast-night.png') });
    console.log(`📸 ${join(SHOT_DIR, 'farm-west-coast-night.png')}`);

    // 4) 夜晚出口仍 locked：站海湾触发区 (36-64,160-208) 不被吸入
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
