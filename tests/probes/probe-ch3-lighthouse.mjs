/**
 * probe-ch3-lighthouse.mjs — 第三章幕一「灯塔开门」验收探针
 *
 * 验收目标（第三章大纲方向稿 幕一 + 灯塔未来内容预埋方案 §四 第三层开放）：
 *   制作人 2026-08-31 开工指令：第二章全节拍完成（ch2_black_dot）→ 灯塔出口解锁。
 *
 * 断言点：
 *   G1 门禁：第二章未完成（无 ch2_black_dot）→ farm 西侧出口仍锁（走不到 lighthouse）
 *   G2 解锁：markTriggered('ch2_black_dot') → farm 西墙缺口打通（Walls rows10-13/col0=0）+ 海湾视觉存在
 *   G3 通行：玩家走到西侧出口 → 场景切换为 lighthouse（locked 出口被幕一门禁放行）
 *   G4 初见：进入后延迟演出打开 → 执灯人方向稿对白（未定稿标注）→ 完成后 ch3_lighthouse_arrival 入档
 *   G5 灯室：开放后 lhRoomGlow 亮起（夜晚 alpha≈0.35）+ 执灯人剪影在场
 *   G6 一次性：重进 lighthouse 不重播初见（triggerOnce 幂等）
 * 附加  无页面错误
 *
 * 依赖：dev server (localhost:5173) + window.debug / window.__game
 * 视口：横屏 1024x768（项目红线）
 * 运行：node tests/probes/probe-ch3-lighthouse.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.PROBE_BASE || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
function result(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const warns = [];
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') warns.push('console: ' + m.text()); });

function seedFarm(withBlackDot) {
  const save = {
    version: '0.5', savedAt: 'ch3-lighthouse', timestamp: Date.now(),
    player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: {} },
    world: { day: 9, hour: 12, minute: 0, coins: 500, level: 2, xp: 180, stamina: 100, minedOres: [] },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: { oldHouse: true, marketSquare: true },
    gameState: { triggeredEvents: Object.assign({
      ch1_awakening: true, ch1_elder_visit: true, ch1_spring_fair: true,
      lighthouse_lit_seen: true, ch2_lighthouse_talked: true, ch2_clock_fixed: true,
      ch2_pier_repaired: true, ch2_night_talk: true, ch2_xiya_secret: true,
    }, withBlackDot ? { ch2_black_dot: true } : {}) },
  };
  return page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
}

async function waitScene(key, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!s && !!s.player;
    }, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}

async function sceneKey() {
  // 注意：SceneManager.start 不停掉 title，getScenes(true)[0] 可能是 title——
  // 找"活跃且带 player"的地图场景才是真实所在（游戏本体走 ScenePlugin.start）
  return page.evaluate(() => {
    const maps = (window.__game?.scene?.getScenes(true) ?? []).filter((s) => s.player);
    return maps.length ? maps[maps.length - 1].scene.key : 'none';
  });
}

try {
  // ============ G1 门禁：无 ch2_black_dot → 出口仍锁 ============
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await seedFarm(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2200);
  const enter = await page.evaluate(() => {
    const s = window.__game.scene.getScene('title');
    if (s) { window.__game.scene.start('farm'); return true; }
    return false;
  });
  await waitScene('farm');
  await sleep(1500);
  const g1 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return { scene: s?.scene?.key, gap: s?.isLighthouseUnlocked?.() ?? null };
  });
  result('G1 门禁：ch2 未完成 → 灯塔出口未解锁', enter && g1.scene === 'farm' && g1.gap === false,
    JSON.stringify(g1));

  // ============ G2 解锁：markTriggered ch2_black_dot → 缺口+海湾视觉 ============
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    window.debug.events.markTriggered('ch2_black_dot');
    s.setupFarmWestGap();
  });
  await sleep(400);
  const g2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return { unlocked: s.isLighthouseUnlocked() };
  });
  result('G2 解锁：ch2_black_dot 标记后幕一门禁放行', g2.unlocked === true, JSON.stringify(g2));

  // ============ G3 通行：传送到西侧缺口 → 场景切换 lighthouse ============
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    s.player.x = 44; s.player.y = 12 * 16; // 缺口内（出口触发区 x 36-64, y 160-208）
  });
  const g3ok = await waitScene('lighthouse', 10000);
  const g3scene = await sceneKey();
  result('G3 通行：farm 西侧缺口 → 切入 lighthouse', g3ok && g3scene === 'lighthouse', `scene=${g3scene}`);
  await sleep(1200);
  const gapTxt = await page.evaluate(() => document.body.innerText);
  result('G3b 缺口首走时刻：石墙的口子→亮着的灯塔', gapTxt.includes('石墙开了一口'), gapTxt.slice(-70));
  await sleep(1600); // 幕一初见延迟 1.4s + 打字

  // ============ G4 初见演出 ============
  const g4 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('lighthouse');
    return {
      open: s.storyDialogue?.isOpen?.() ?? false,
      keeper: !!s.ch3KeeperGfx,
      marked: window.debug.events.hasTriggered('ch3_lighthouse_arrival'),
    };
  });
  result('G4 初见：执灯人在场 + 幕一演出打开', g4.keeper && g4.open, JSON.stringify(g4));
  // 跳过演出 → 标记入档
  await page.evaluate(() => window.__game.scene.getScene('lighthouse').storyDialogue?.skip());
  await sleep(500);
  const g4b = await page.evaluate(() => window.debug.events.hasTriggered('ch3_lighthouse_arrival'));
  result('G4b 演出完成：ch3_lighthouse_arrival 入档', g4b === true, `marked=${g4b}`);

  // ============ G5 灯室亮起 + 执灯人剪影在场 ============
  const g5 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('lighthouse');
    return { glow: s.lhRoomGlow ? s.lhRoomGlow.alpha : -1, keeper: !!s.ch3KeeperGfx };
  });
  result('G5 灯室：开放后 glow 亮起（>0）+ 执灯人在场', g5.glow > 0 && g5.keeper, JSON.stringify(g5));

  // ============ G6 一次性：切走再回来不重播 ============
  await page.evaluate(() => { window.__game.scene.start('farm', { spawn: { x: 240, y: 96 } }); });
  await waitScene('farm');
  await sleep(600);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    s.player.x = 44; s.player.y = 12 * 16;
  });
  await waitScene('lighthouse');
  await sleep(2600); // 超过初见延迟窗口：已标记 → 不重播
  const g6 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('lighthouse');
    return { open: s.storyDialogue?.isOpen?.() ?? false, queued: s.ch3ArrivalQueued };
  });
  result('G6 一次性：重进 lighthouse 不重播初见', g6.open === false, JSON.stringify(g6));

  // ============ 附加 ============
  result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));
} catch (e) {
  console.log('\n❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-ch3-lighthouse 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
