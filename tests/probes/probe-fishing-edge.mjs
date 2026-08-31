/**
 * probe-fishing-edge.mjs — 钓鱼 Phase 1 边界/时序/资源清理互补探针
 *
 * 与 probe-fishing-phase1.mjs 互补（不重复其端到端功能 + 背包 +1 验证）：
 *   E1 钓点距离边界：刚好范围外不触发交互（玩家站 interactRange+5 处）
 *   E2 DOM hint 时序：靠近 → hint 出现；离开 → hint 消失
 *   E3 收竿窗口提示时序：realBite → hint 出现；成功 → hint 消失
 *   E4 状态机内部方法直接接线：enterFakeBite/enterRealBite/onFishingSuccess/onFishingFail 均可调用
 *   E5 casting/waiting 期间按 E 被忽略（不打断动画）
 *   E6 钓鱼中其他交互（老树/捕虫）不被截断——非 town 场景或远离钓点时 tryFishingInteract 返回 false
 *   E7 场景切换清理：钓鱼中切 farm → fishingState 复位 idle + visuals 销毁 + hint DOM 移除
 *   E8 连续 5 次成功累计：青禾鲫 +5（验证可重复触发，无状态残留）
 *   E9 FISHING_CONFIG 不可变性：static readonly，字段值与任务卡 §四一致
 *   E10 无页面错误
 *
 * 设计原则：
 *   - 不依赖 Math.random 覆写（直接调内部方法绕过随机，与功能探针正交）
 *   - 不依赖 tryInteract 键盘事件（直接调 tryFishingInteract / 内部方法）
 *   - 不重复读取背包 UI（用 window.debug.getItemCount 验证数据层，UI 已被功能探针覆盖）
 *
 * 依赖：dev server localhost:5173 + window.debug / window.__game
 * 视口：横屏 1024x768
 * 运行：node tests/probes/probe-fishing-edge.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = 16;
const SPOT = { x: 5.5 * T, y: 12 * T + T / 2 }; // (88, 200)
const RANGE = 32; // FISHING_CONFIG.interactRange

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.bringToFront();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404/.test(m.text())) {
    errors.push('console: ' + m.text());
  }
});

async function waitScene(key, timeout = 20000) {
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

/** 读取钓鱼状态 + 关键字段 */
async function fishInfo() {
  return page.evaluate(() => {
    const s = window.__game?.scene?.getScene('town');
    if (!s) return null;
    return {
      state: s.fishingState,
      hasVisuals: !!s.fishingVisuals,
      hasHint: !!s.fishingInteractHint,
      hasReelHint: !!s.fishingReelHint,
      config: s.constructor.FISHING_CONFIG,
    };
  });
}

/** 移动玩家到指定坐标 */
async function moveTo(x, y) {
  await page.evaluate(([px, py]) => {
    const s = window.__game.scene.getScene('town');
    s.player.x = px;
    s.player.y = py;
  }, [x, y]);
  await sleep(400); // 等 update 循环跑几帧，hint 检测生效
}

/** 直接调 tryFishingInteract */
async function tryFish() {
  return page.evaluate(() => window.__game.scene.getScene('town').tryFishingInteract());
}

/** 强制清理（每个用例前复位） */
async function cleanup() {
  await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('town');
    if (s) s.cleanupFishing();
  });
  await sleep(300);
}

/** 检查 DOM 是否包含指定文本 */
async function domIncludes(text) {
  return page.evaluate((t) => document.body.innerHTML.includes(t), text);
}

try {
  // ============ 前置：清存档 + 进 town ============
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(1000);
  await page.evaluate(() => {
    const b = document.getElementById('intro-skip-btn');
    if (b) b.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    window.debug.setChapter(1);
    window.debug.setStoryStep('observatory_complete');
    window.debug.setTime(10, 0);
    window.debug.markCh1TownIntroDone();
  });
  await page.evaluate(([x, y]) => {
    window.__game.scene.start('town', { spawn: { x, y } });
  }, [SPOT.x, SPOT.y + 5]);
  await waitScene('town');
  await sleep(1000);

  // ============ E9 FISHING_CONFIG 不可变性 + 字段值与任务卡 §四一致 ============
  let info = await fishInfo();
  const cfg = info.config;
  check(
    'E9 FISHING_CONFIG 字段值与任务卡 §四一致（6 项核心 + 4 项辅助）',
    cfg &&
      cfg.biteDelayMin === 2.0 && cfg.biteDelayMax === 5.0 &&
      cfg.fakeBiteProbability === 0.30 && cfg.realBiteWindow === 0.8 &&
      cfg.successFeedbackDuration === 0.7 && cfg.castDuration === 0.8 &&
      cfg.fakeBiteDuration === 0.4 && cfg.fakeBiteRecoverDuration === 0.3 &&
      cfg.failFeedbackDuration === 0.4 && cfg.interactRange === 32,
    cfg ? JSON.stringify(cfg) : 'config 缺失',
  );

  // ============ E1 钓点距离边界：刚好范围外不触发 ============
  await cleanup();
  // 玩家站钓点下方 RANGE+5 处（37px 距离 > 32 范围）
  await moveTo(SPOT.x, SPOT.y + RANGE + 5);
  const farRet = await tryFish();
  check(
    'E1 玩家在范围外（37px > 32）调 tryFishingInteract 返回 false',
    farRet === false,
    `ret=${farRet}（期望 false）`,
  );
  const farHint = await domIncludes('按 [E] 钓鱼');
  check('E1 范围外不显示钓鱼 hint', farHint === false, `hint 显示了`);

  // ============ E2 DOM hint 时序：靠近 → 出现；离开 → 消失 ============
  await moveTo(SPOT.x, SPOT.y + 5); // 范围内
  await sleep(500); // 等 update 检测
  let hintShown = await domIncludes('按 [E] 钓鱼');
  check('E2 靠近钓点 → 显示「按 [E] 钓鱼」', hintShown === true, 'hint 未显示');

  await moveTo(SPOT.x, SPOT.y + RANGE + 10); // 离开
  await sleep(500);
  hintShown = await domIncludes('按 [E] 钓鱼');
  check('E2 离开钓点 → hint 消失', hintShown === false, 'hint 未消失');

  // ============ E4 内部方法接线：直接调各状态进入方法 ============
  await cleanup();
  await moveTo(SPOT.x, SPOT.y + 5);
  // 启动钓鱼 → casting → waiting
  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.startFishing());
  await sleep(100);
  info = await fishInfo();
  check('E4a startFishing → casting', info.state === 'casting', `state=${info.state}`);

  await sleep(900); // castDuration 0.8s
  info = await fishInfo();
  check('E4b casting 0.8s 后 → waiting', info.state === 'waiting', `state=${info.state}`);

  // 直接调 enterFakeBite（绕过随机）
  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.enterFakeBite());
  await sleep(100);
  info = await fishInfo();
  check('E4c enterFakeBite → fakeBite', info.state === 'fakeBite', `state=${info.state}`);

  // 直接调 onFishingFail('early')
  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.onFishingFail('early'));
  await sleep(100);
  info = await fishInfo();
  check('E4d onFishingFail(early) → fail', info.state === 'fail', `state=${info.state}`);
  await sleep(500); // 等 failFeedbackDuration
  info = await fishInfo();
  check('E4e fail 0.4s 后 → idle', info.state === 'idle', `state=${info.state}`);

  // ============ E3 收竿窗口提示时序 ============
  await cleanup();
  await moveTo(SPOT.x, SPOT.y + 5);
  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.startFishing());
  await sleep(900); // 直接进 waiting
  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.enterRealBite());
  await sleep(150); // 等提示渲染
  info = await fishInfo();
  let reelHintShown = await domIncludes('收竿');
  check(
    'E3a realBite → 收竿提示显示',
    info.state === 'realBite' && reelHintShown === true,
    `state=${info.state} hint=${reelHintShown}`,
  );

  // 在 realBite 窗口内收竿 → success
  await tryFish();
  await sleep(200);
  info = await fishInfo();
  reelHintShown = await domIncludes('收竿');
  check(
    'E3b 成功后收竿提示消失',
    (info.state === 'success' || info.state === 'idle') && reelHintShown === false,
    `state=${info.state} hint=${reelHintShown}`,
  );
  await sleep(800); // 等成功反馈

  // ============ E5 casting/waiting 期间按 E = 主动取消（2026-08-30 行为变更） ============
  // 旧契约：casting/waiting 按被忽略，玩家误触只能干等 2~5s 咬钩流程。
  // 新契约：立即取消回 idle（enterWaiting 的 delayedCall 自带 state 守卫，取消安全）。
  await cleanup();
  await moveTo(SPOT.x, SPOT.y + 5);
  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.startFishing());
  await sleep(100);
  // casting 期间按 E → 取消
  const retCasting = await tryFish();
  info = await fishInfo();
  check(
    'E5a casting 期间按 E 主动取消（返回 true + 回 idle）',
    retCasting === true && info.state === 'idle',
    `ret=${retCasting} state=${info.state}`,
  );

  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.startFishing());
  await sleep(900); // 进 waiting
  // waiting 期间按 E → 取消
  const retWaiting = await tryFish();
  info = await fishInfo();
  check(
    'E5b waiting 期间按 E 主动取消（返回 true + 回 idle）',
    retWaiting === true && info.state === 'idle',
    `ret=${retWaiting} state=${info.state}`,
  );

  // ============ E6 非 town 场景 tryFishingInteract 返回 false ============
  await cleanup();
  // 切到 farm 场景
  await page.evaluate(() => {
    window.__game.scene.start('farm', { spawn: { x: 240, y: 96 } });
  });
  await waitScene('farm');
  await sleep(800);
  const farmRet = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    // farm 场景也有 tryFishingInteract 方法（继承自同一 class），但 mapKey 检查应阻断
    if (typeof s.tryFishingInteract !== 'function') return 'no_method';
    return s.tryFishingInteract();
  });
  check(
    'E6 非 town 场景调 tryFishingInteract 返回 false（mapKey 门禁）',
    farmRet === false || farmRet === 'no_method',
    `ret=${farmRet}`,
  );

  // ============ E7 场景切换清理：钓鱼中切 farm → 复位 ============
  // 切回 town 启动钓鱼
  await page.evaluate(([x, y]) => {
    window.__game.scene.start('town', { spawn: { x, y } });
  }, [SPOT.x, SPOT.y + 5]);
  await waitScene('town');
  await sleep(800);
  await moveTo(SPOT.x, SPOT.y + 5);
  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.startFishing());
  await sleep(100);
  await page.evaluate(() => window.__game.scene.getScene('town').fishingController.enterRealBite());
  await sleep(100);

  // 钓鱼中切 farm（触发 town 的 shutdown → cleanupFishing）
  await page.evaluate(() => {
    window.__game.scene.start('farm', { spawn: { x: 240, y: 96 } });
  });
  await waitScene('farm');
  await sleep(800);

  // 切回 town 检查状态是否复位
  await page.evaluate(([x, y]) => {
    window.__game.scene.start('town', { spawn: { x, y } });
  }, [SPOT.x, SPOT.y + 5]);
  await waitScene('town');
  await sleep(1000);

  info = await fishInfo();
  // 回到 town 时玩家仍站在钓点附近，正常逻辑会重新显示靠近提示；
  // 这里只检查钓鱼中提示是否残留，避免把合法的 idle hint 判为泄漏。
  const hintLeak = await domIncludes('收竿');
  check(
    'E7 场景切换后状态复位 idle + visuals 销毁 + 无收竿 hint 残留',
    info.state === 'idle' && info.hasVisuals === false && hintLeak === false,
    `state=${info.state} visuals=${info.hasVisuals} hintLeak=${hintLeak}`,
  );

  // ============ E8 连续 5 次成功累计：青禾鲫 +5 ============
  await cleanup();
  await moveTo(SPOT.x, SPOT.y + 5);
  // 记录所有普通鱼的总数。生产代码会按时段/概率选择多鱼种，不能再假设每竿都是青禾鲫。
  const fishKinds = ['qinghe_crucian', 'river_shrimp', 'dusk_fish', 'moon_bass', 'river_eel', 'common_carp', 'big_blue_fish'];
  const readRegularFishTotal = () => page.evaluate((kinds) =>
    kinds.reduce((total, kind) => total + (window.debug.getItemCount(kind) || 0), 0), fishKinds);
  const before5 = await readRegularFishTotal();

  for (let i = 1; i <= 5; i++) {
    // 固定为基准鱼，专门验证连续成功的状态清理，不把物种随机/鱼苗选择混入本用例。
    // v1.2：状态机迁至 FishingController 后 startFishing() 内部会 pickCurrentFish() 覆盖，
    // 所以必须在 startFishing 之后再固定 currentFish（此前设 scene.currentFish 已是无效旧路径）。
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('town');
      s.fishingController.startFishing();
      s.fishingController.currentFish = 'qinghe_crucian';
    });
    await sleep(900); // casting → waiting
    await page.evaluate(() => window.__game.scene.getScene('town').fishingController.enterRealBite());
    await sleep(150);
    await tryFish(); // 收竿成功
    await sleep(900); // 等成功反馈结束回 idle
    const count = await readRegularFishTotal();
    check(
      `E8 第 ${i} 次普通鱼收获后总数 = ${before5 + i}`,
      count === before5 + i,
      `count=${count}（期望 ${before5 + i}）`,
    );
  }

  const finalCount = await readRegularFishTotal();
  check(
    'E8 连续 5 次普通鱼收获累计 +5（无状态残留）',
    finalCount === before5 + 5,
    `before=${before5} after=${finalCount}（期望 ${before5 + 5}）`,
  );

  // ============ E10 无页面错误 ============
  const realErrors = errors.filter((e) => !/favicon|404|the-key/.test(e));
  check('E10 无页面错误（pageerror / console.error）', realErrors.length === 0,
    realErrors.slice(0, 3).join(' | '));

  console.log(`\n===== probe-fishing-edge 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('\n❌ 探针异常:', e.message);
  console.log(e.stack);
  fail++;
} finally {
  await browser.close();
}

process.exit(fail > 0 ? 1 : 0);
