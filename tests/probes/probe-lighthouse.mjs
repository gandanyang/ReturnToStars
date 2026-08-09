/**
 * 灯塔轻量版（2026-08-10 制作人解冻）—— 运行时验证探针
 *
 * 验证（Level 2）：
 *   A 进入灯塔：scene.start('lighthouse') → key=lighthouse，地图/瓦片加载无错误
 *   B 塔身碰撞：键盘向北走 → 被塔基挡住（y 不低于塔基南缘 ~160）
 *   C 海边挡海：键盘向西走 → 被岩石带挡住（x 不低于岩带 ~64）
 *   D E 交互：setPosition 到航海日志锚点 (168,216) 附近 → 按 E → 文本出现「航海日志」
 *   E 西侧出口 → farm：setPosition 到左侧通道口 (8,176) → 场景切 farm（spawn 海湾缺口内侧 80,224）
 *   F farm 西侧海湾锁定（2026-08-10 制作人方案：灯塔岛在 farm 西边）：灯塔=未来内容预埋，
 *     正常游玩不可进入；玩家站海湾出口触发区 (36-64,160-208) 应不被吸入 lighthouse，仍留在 farm
 *   G 全程无运行时错误
 *
 * 前置：dev server（npm run dev）；node tests/probes/probe-lighthouse.mjs
 * 视口：横屏 1024×768（项目手机端只支持横屏，探针禁止竖屏视口——probe-farm-tap 教训）
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
// 灯塔关键坐标（与 gen_lighthouse_map.py / exits.ts 一致）
const LIGHTHOUSE = {
  spawn: { x: 240, y: 240 },          // 塔前草地
  towerBase: { yTop: 128, yBot: 176 }, // 塔基 rows 8-9 → 像素 y 128-176（含瓦片外沿）
  rockWest: 64,                        // 西侧岩石带 cols 2-3 → x 32-64
  logbook: { x: 168, y: 216 },         // 航海日志交互锚点（物件 (10,12) 南侧）
  exitZone: { x: 8, y: 176 },          // 西侧出口触发区 (0-16, 144-224) 内
};
// farm 西侧海湾出口（exits.ts）：触发区 x 36-64, y 160-208
const FARM_BAY = { x: 50, y: 176 };

const makeSave = (scene, x, y) => ({
  version: '0.5', savedAt: 'lighthouse-probe', timestamp: Date.now(),
  player: { x, y, scene, facing: 'down', inventory: {} },
  world: { day: 2, hour: 10, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'done' },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true } },
  worldRestore: {},
  story: { storyStep: 'done' },
  mapFlags: {},
  gameState: { triggeredEvents: {} },
});

async function run() {
  console.log('=== 灯塔轻量版（2026-08-10）运行时验证 ===\n');
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

  const bodyText = () => page.evaluate(() => document.body.innerText);
  const dialogueText = () => page.evaluate(() => {
    const g = window.__game;
    const s = g.scene.getScenes(true).find((x) => x.player);
    return s?.dialogueText?.text ?? '';
  });
  const playerState = () => page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    // 注意：getScenes(true)[0] 可能是 title（scene.start 后 title 仍 active）
    // 必须找持有 player 的游戏场景，否则读到 title 会误判"未进入目标场景"
    const s = g.scene.getScenes(true).find((x) => x.player) || g.scene.getScenes(true)[0];
    const p = s?.player;
    return {
      key: s?.scene?.key ?? 'none',
      x: p ? Math.round(p.x) : -1,
      y: p ? Math.round(p.y) : -1,
    };
  });
  const startScene = (key, x, y) => page.evaluate(([k, px, py]) => {
    window.__game.scene.start(k, { spawn: { x: px, y: py } });
  }, [key, x, y]);
  const holdKey = async (key, ms) => {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
    await sleep(400); // 物理稳定
  };
  const waitScene = async (key, timeoutMs = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const st = await playerState();
      if (st && st.key === key) return st;
      await sleep(300);
    }
    const st = await playerState();
    throw new Error(`未能进入场景 ${key}（实际 ${st?.key}）错误=${errors.slice(0, 5).join(' | ')}`);
  };

  const waitGameReady = async (timeoutMs = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const ready = await page.evaluate(() => !!(window.__game && window.__game.scene));
      if (ready) return;
      await sleep(300);
    }
    throw new Error('game 未就绪');
  };

  // 基础：reload 等游戏就绪（scene.start 测试钩子直接切场景，不走 title 长流程）
  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'networkidle2' });
  await waitGameReady();
  await sleep(1000);

  // A. 进入灯塔
  await startScene('lighthouse', LIGHTHOUSE.spawn.x, LIGHTHOUSE.spawn.y);
  const stA = await waitScene('lighthouse');
  check('A 进入灯塔场景', stA.key === 'lighthouse', `key=${stA.key} player=(${stA.x},${stA.y})`);
  await sleep(800);

  // B. 塔身碰撞：从塔前向北走 2.5s，应被塔基挡住
  //    塔基 tiles rows 8-9 → 像素 y 128-160（瓦片物理碰撞体上缘）；玩家中心被挡在 y≥160 外
  await startScene('lighthouse', LIGHTHOUSE.spawn.x, LIGHTHOUSE.spawn.y);
  await waitScene('lighthouse');
  await sleep(600);
  await holdKey('KeyW', 2500);
  const stB = await playerState();
  const bCollide = stB.y >= LIGHTHOUSE.towerBase.yTop && stB.y < 200;
  check('B 塔基碰撞挡路', bCollide, `player=(${stB.x},${stB.y}) 被挡在塔基南缘(y≥160)`);

  // C. 海边挡海：从塔前向西走 3s，应被西侧岩石带挡住（x 不低于 64）
  await startScene('lighthouse', LIGHTHOUSE.spawn.x, LIGHTHOUSE.spawn.y);
  await waitScene('lighthouse');
  await sleep(600);
  await holdKey('KeyA', 3000);
  const stC = await playerState();
  check('C 岩石带挡海', stC.x >= LIGHTHOUSE.rockWest - 8, `player=(${stC.x},${stC.y}) 应停在岩带东缘(x≈72)`);

  // D. E 交互：航海日志（锚点 168,216）——文本渲染在 canvas（dialogueText），非 DOM
  await startScene('lighthouse', LIGHTHOUSE.logbook.x, LIGHTHOUSE.logbook.y);
  await waitScene('lighthouse');
  await sleep(600);
  await page.keyboard.press('KeyE');
  await sleep(700);
  const txtD = await dialogueText();
  const dOk = txtD.includes('航海日志') || txtD.includes('等星星落下来');
  check('D 航海日志 E 交互', dOk, txtD ? `文本: ${txtD.slice(0, 40)}` : 'dialogueText 为空');

  // E. 西侧出口 → farm（spawn 海湾缺口内侧 80,224）
  await startScene('lighthouse', LIGHTHOUSE.exitZone.x, LIGHTHOUSE.exitZone.y);
  await waitScene('lighthouse');
  await sleep(500);
  const stE = await waitScene('farm', 8000);
  check('E 灯塔出口→农场', stE.key === 'farm' && stE.x > 64 && stE.y > 200, `player=(${stE.x},${stE.y}) 出生海湾缺口内侧`);

  // F. farm 西侧海湾锁定（2026-08-10 制作人方案：灯塔岛在 farm 西边，出口 locked 预埋）
  await startScene('farm', 240, 240);
  await waitScene('farm');
  await sleep(600);
  // 站到海湾出口触发区 (36-64, 160-208) 内 2.5s：应不被吸入 lighthouse（仍留 farm）
  await page.evaluate(([x, y]) => {
    const g = window.__game;
    const s = g.scene.getScenes(true).find((sc) => sc.player);
    s.player.setPosition(x, y);
  }, [FARM_BAY.x, FARM_BAY.y]);
  await sleep(2500);
  const stF = await playerState();
  check('F 海湾出口锁定（灯塔不可进入）', stF.key === 'farm', `player=(${stF.x},${stF.y}) 仍在 farm（locked 出口不触发）`);

  // G. 全程无运行时错误
  const errList = errors.filter((e) => !e.includes('favicon'));
  check('G 无运行时错误', errList.length === 0, errList.length ? errList.slice(0, 5).join(' | ') : '');

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('探针异常:', e.message);
  process.exit(1);
});
