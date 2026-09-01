/**
 * probe-fishing-phase1.mjs — 钓鱼 Phase 1 + Phase 3 探针（逻辑层驱动版）
 *
 * 验证（《钓鱼MVP-设计与施工规范-v0.1》§十六 + 任务卡 §六 + Phase 3 内容接入）：
 *   T1 钓点进入：tryFishingInteract 入口守卫全清 → true → casting
 *   T2 甩竿 → 等待：startFishing → casting → enterWaiting → waiting
 *   T3 真咬钩 → 成功收竿：onFishingSuccess → 背包青禾鲫 +1 + 浮字提示
 *   T4 假咬钩期间收竿 → 过早失败（onFishingFail('early')，背包不变）
 *   T5 错过窗口 → 超时失败（onFishingFail('timeout')，背包不变）
 *   T6 失败后状态复位 → 可立即重试（再成功 → 青禾鲫 +1 = 2）
 *   T8 Phase 3 鱼种：pickCurrentFish 时段逻辑（12:00→河虾/青禾鲫；18:00→黄昏鱼）
 *       + 黄昏鱼实际收获入背包 + 三种鱼 ITEM_DEFS / 售价数据
 *   T7 无运行时错误
 *
 * 驱动方式（2026-08-14）：
 *   - 在真实 town 场景实例上同步直调状态机方法（TS private 运行时可达），
 *     绕开键盘 / 定时器 / 游戏循环依赖（本机 Chrome 失焦 rAF 节流会导致键盘不可靠）。
 *   - 不覆写全局 Math.random 期间创建 Phaser Text（Phaser UUID() 依赖随机数，
 *     固定值会让纹理 key 冲突 → Text 创建崩溃）；鱼种用「直接设置 currentFish」控制。
 *   - 不改游戏时间中途（debug.setTime 会触发 NPC 重建 + 大量 Text 创建，多会话易触 Phaser 边界）；
 *     黄昏鱼验证用独立会话（seed hour=18）。
 *
 * v1.1 修订（2026-08-28）：钓鱼状态机已从 MapScene 物理搬迁至 FishingController（s.fishingController，
 *   原 MapScene.* 方法逐一搬迁）；探针状态机直调统一改走 controller 实例（TS private 运行时可达不变）。
 *   场景层保留项不动：tryFishingInteract()（MapScene 代理）/ fishingState（getter）/ fishingSpotPos / dialogueText。
 *
 * 依赖：dev server localhost:5173；真实 Chromium。
 * 运行：node tests/probes/probe-fishing-phase1.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOT_DIR, { recursive: true });

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
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

/** 进入 town（种子存档 → reload → Enter → 等 town 场景就绪）；hour 可配（Phase 3 鱼种窗口） */
async function enterTown(hour = 12) {
  const save = {
    version: '0.5', savedAt: 'fishing-phase1', timestamp: Date.now(),
    player: { x: 88, y: 200, scene: 'town', facing: 'up', inventory: {} },
    world: { day: 1, hour, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'observatory_complete', ch1TownIntroDone: true },
    chapter: 1,
    worldRestore: {},
    gameState: { triggeredEvents: {} },
  };
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1600);
  await page.bringToFront();
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.bringToFront();
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
  }
  // 场景激活 ≠ create() 完成：等 this.player 就绪后再驱动状态机，
  // 否则直调 onFishingSuccess → showDialogueText 会撞上 player 未定义（实测偶发，见 2026-08-17）。
  for (let i = 0; i < 30; i++) {
    const ready = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('town');
      return !!(s && s.player && s.mapKey === 'town');
    });
    if (ready) break;
    await sleep(300);
  }
  await sleep(2000);
}

/** 会话主序列（真实场景实例同步直调状态机；forceFish 固定鱼种保证断言确定性） */
async function runMainSequence() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('town');
      const clearText = () => {
        if (s.dialogueText) { s.dialogueText.destroy(); s.dialogueText = null; }
      };
      if (s.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.();

      const readInvAll = () => {
        if (s.backpackPanel && !s.backpackPanel.isOpen()) s.backpackPanel.open();
        const text = document.getElementById('bp-grid')?.textContent ?? '';
        if (s.backpackPanel && s.backpackPanel.isOpen()) s.backpackPanel.close();
        const n = (name) => {
          const m = text.match(new RegExp(name + '\\s*×(\\d+)'));
          return m ? parseInt(m[1], 10) : 0;
        };
        return { qinghe: n('青禾鲫'), shrimp: n('河虾'), dusk: n('黄昏鱼') };
      };

      // ── T8a 鱼种时段逻辑（pickCurrentFish：纯状态读取，可安全用固定随机；随即恢复）──
      {
        const rndSave = Math.random;
        // 生态分层 v1.3：第一个随机用于鱼苗判定（≥0.15 跳过鱼苗），第二个用于物种
        let seq; let si = 0;
        const mock = (arr) => { seq = arr; si = 0; Math.random = () => seq[si++] ?? 0.5; };
        mock([0.5, 0.1]);
        s.fishingController.pickCurrentFish(); out.pickDay = s.fishingController.currentFish;       // 12:00 + 低随机 → 河虾
        mock([0.5, 0.99]);
        s.fishingController.pickCurrentFish(); out.pickDay99 = s.fishingController.currentFish;     // 12:00 + 高随机 → 青禾鲫
        mock([0.5, 0.05]);
        s.fishingController.pickCurrentFish(); out.pickCarp = s.fishingController.currentFish;      // 12:00 + 更低随机 → 鲤鱼（全天低概率）
        Math.random = rndSave;
      }

      // ── T8b 三种鱼数据（ITEM_DEFS / 售价；动态 import 静态数据，实例分裂不影响）──
      {
        const inv = await import('/src/data/Inventory.ts');
        const eco = await import('/src/data/Economy.ts');
        out.data = {
          names: [inv.getItemDef('qinghe_crucian').name, inv.getItemDef('river_shrimp').name, inv.getItemDef('dusk_fish').name],
          prices: [eco.SELLABLE_ITEMS['qinghe_crucian'], eco.SELLABLE_ITEMS['river_shrimp'], eco.SELLABLE_ITEMS['dusk_fish']],
          names2: [inv.getItemDef('river_eel').name, inv.getItemDef('common_carp').name, inv.getItemDef('big_blue_fish').name],
          prices2: [eco.SELLABLE_ITEMS['river_eel'], eco.SELLABLE_ITEMS['common_carp'], eco.SELLABLE_ITEMS['big_blue_fish']],
        };
      }

      // ── 主序列：固定 currentFish=青禾鲫（不覆写全局 random，避免破坏 Phaser UUID）──
      const dx = s.player.x - s.fishingSpotPos.x;
      const dy = s.player.y - s.fishingSpotPos.y;
      out.guards = {
        mapKey: s.mapKey, state: s.fishingState,
        distSq: Math.round(dx * dx + dy * dy), rangeSq: 32 * 32,
        sdOpen: !!s.storyDialogue?.isOpen?.(),
        spot: { x: Math.round(s.fishingSpotPos.x), y: Math.round(s.fishingSpotPos.y) },
        player: { x: Math.round(s.player.x), y: Math.round(s.player.y) },
      };
      const ret = s.tryFishingInteract();
      out.t1 = { ret, state: s.fishingState };
      if (s.fishingState !== 'casting') {
        out.t1.fallback = true;
        s.fishingController.startFishing();
      }
      s.fishingController.currentFish = 'qinghe_crucian';

      out.t2 = { casting: s.fishingState };
      s.fishingController.enterWaiting();
      out.t2.waiting = s.fishingState;

      s.fishingController.enterRealBite();
      out.t3 = { realBite: s.fishingState, reelHint: document.body.textContent.includes('快按 [E] 收竿！') };
      s.fishingController.onFishingSuccess();
      out.t3.success = s.fishingState;
      out.t3.floatText = s.dialogueText?.text === '钓到一条青禾鲫。';
      clearText();
      s.fishingController.endFishing();
      out.t3.idle = s.fishingState;
      out.inv1 = readInvAll();

      s.fishingController.startFishing();
      s.fishingController.currentFish = 'qinghe_crucian';
      out.t4 = { casting: s.fishingState };
      s.fishingController.enterWaiting();
      s.fishingController.enterFakeBite();
      out.t4.fakeBite = s.fishingState;
      s.fishingController.onFishingFail('early');
      out.t4.fail = s.fishingState;
      out.t4.reelHintCleared = !document.body.textContent.includes('快按 [E] 收竿！');
      s.fishingController.endFishing();
      out.t4.idle = s.fishingState;
      out.inv2 = readInvAll();

      s.fishingController.startFishing();
      s.fishingController.enterWaiting();
      s.fishingController.enterRealBite();
      s.fishingController.onFishingFail('timeout');
      out.t5 = { fail: s.fishingState };
      out.t5.reelHintCleared = !document.body.textContent.includes('快按 [E] 收竿！');
      s.fishingController.endFishing();
      out.t5.idle = s.fishingState;
      out.inv3 = readInvAll();

      s.fishingController.startFishing();
      s.fishingController.currentFish = 'qinghe_crucian';
      out.t6 = { retryCasting: s.fishingState };
      s.fishingController.enterWaiting();
      s.fishingController.enterRealBite();
      s.fishingController.onFishingSuccess();
      s.fishingController.endFishing();
      out.t6.idle = s.fishingState;
      clearText();
      out.inv4 = readInvAll();

      return out;
    } catch (e) {
      return { __error: e.message, stack: e.stack ?? '' };
    }
  });
}

/** 黄昏鱼会话：seed hour=18 → pickCurrentFish 逻辑 + 实际收获 */
async function runDuskSession() {
  return page.evaluate(() => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('town');
      const rndSave = Math.random;
      // 生态分层 v1.3：第一个随机跳过鱼苗，第二个给物种（18:00 黄昏窗口）
      let seq; let si = 0;
      const mock = (arr) => { seq = arr; si = 0; Math.random = () => seq[si++] ?? 0.5; };
      mock([0.5, 0.1]);
      s.fishingController.pickCurrentFish();
      out.pickBig = s.fishingController.currentFish;    // 18:00 + 低随机 → 大青鱼
      mock([0.5, 0.4]);
      s.fishingController.pickCurrentFish();
      out.pickDusk = s.fishingController.currentFish;   // 18:00 + 中随机 → 黄昏鱼
      Math.random = rndSave;

      s.fishingController.startFishing();
      s.fishingController.currentFish = 'dusk_fish'; // 实际收获验证：固定黄昏鱼（startFishing 内部按时间随机，探针强制）
      s.fishingController.enterWaiting();
      s.fishingController.enterRealBite();
      s.fishingController.onFishingSuccess();
      s.fishingController.endFishing();
      if (s.dialogueText) { s.dialogueText.destroy(); s.dialogueText = null; }

      if (s.backpackPanel && !s.backpackPanel.isOpen()) s.backpackPanel.open();
      const text = document.getElementById('bp-grid')?.textContent ?? '';
      if (s.backpackPanel && s.backpackPanel.isOpen()) s.backpackPanel.close();
      const m = text.match(/黄昏鱼\s*×(\d+)/);
      out.invDusk = m ? parseInt(m[1], 10) : 0;
      return out;
    } catch (e) {
      return { __error: e.message, stack: e.stack ?? '' };
    }
  });
}

/** 夜间会话：seed hour=20 → 河鳗 */
async function runNightSession() {
  return page.evaluate(() => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('town');
      const rndSave = Math.random;
      let seq = [0.5, 0.1]; let si = 0;
      Math.random = () => seq[si++] ?? 0.5;
      s.fishingController.pickCurrentFish();
      out.pickEel = s.fishingController.currentFish;    // 20:00 + 低随机 → 河鳗（夜间）
      Math.random = rndSave;
      return out;
    } catch (e) {
      return { __error: String(e), stack: e.stack };
    }
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);

  // ── 会话 1：12:00 主序列 + 鱼种逻辑 + 数据 ──
  await enterTown(12);
  const r = await runMainSequence();
  if (r.__error) throw new Error(`主序列崩于: ${r.__error}\n${r.stack}`);

  console.log('guards:', JSON.stringify(r.guards));

  check('T1 守卫全清（town/idle/在钓点/无对话）',
    r.guards.mapKey === 'town' && r.guards.state === 'idle' &&
    r.guards.distSq <= r.guards.rangeSq && r.guards.sdOpen === false &&
    r.guards.spot.x === 88 && r.guards.spot.y === 200, JSON.stringify(r.guards));
  check('T1 tryFishingInteract → true 且进入 casting',
    r.t1.ret === true && r.t1.state === 'casting', `ret=${r.t1.ret} state=${r.t1.state}${r.t1.fallback ? '（fallback）' : ''}`);

  check('T2 startFishing → casting', r.t2.casting === 'casting', `state=${r.t2.casting}`);
  check('T2 enterWaiting → waiting', r.t2.waiting === 'waiting', `state=${r.t2.waiting}`);

  check('T3 enterRealBite → realBite', r.t3.realBite === 'realBite', `state=${r.t3.realBite}`);
  check('T3 收竿窗口提示出现', r.t3.reelHint === true, '');
  check('T3 onFishingSuccess → success', r.t3.success === 'success', `state=${r.t3.success}`);
  check('T3 浮字「钓到一条青禾鲫。」', r.t3.floatText === true, `float=${r.t3.floatText}`);
  check('T3 endFishing → idle', r.t3.idle === 'idle', `state=${r.t3.idle}`);
  check('T3 青禾鲫进入背包 +1', r.inv1.qinghe === 1, JSON.stringify(r.inv1));

  check('T4 enterFakeBite → fakeBite', r.t4.fakeBite === 'fakeBite', `state=${r.t4.fakeBite}`);
  check('T4 onFishingFail(early) → fail', r.t4.fail === 'fail', `state=${r.t4.fail}`);
  check('T4 失败后回到 idle', r.t4.idle === 'idle', `state=${r.t4.idle}`);
  check('T4 过早失败不获得鱼（背包仍 1）', r.inv2.qinghe === 1, JSON.stringify(r.inv2));

  check('T5 onFishingFail(timeout) → fail', r.t5.fail === 'fail', `state=${r.t5.fail}`);
  check('T5 失败后回到 idle', r.t5.idle === 'idle', `state=${r.t5.idle}`);
  check('T5 超时失败不获得鱼（背包仍 1）', r.inv3.qinghe === 1, JSON.stringify(r.inv3));

  check('T6 失败后立即重试（startFishing → casting）', r.t6.retryCasting === 'casting', `state=${r.t6.retryCasting}`);
  check('T6 重试成功 → 青禾鲫背包 +1（=2）', r.inv4.qinghe === 2, JSON.stringify(r.inv4));

  // T8 Phase 3 鱼种
  check('T8 pickCurrentFish：12:00+低随机 → 河虾', r.pickDay === 'river_shrimp', `got=${r.pickDay}`);
  check('T8 pickCurrentFish：12:00+高随机 → 青禾鲫', r.pickDay99 === 'qinghe_crucian', `got=${r.pickDay99}`);
  check('T8 12:00+更低随机 → 鲤鱼（全天低概率）', r.pickCarp === 'common_carp', `got=${r.pickCarp}`);
  check('T8 三种鱼 ITEM_DEFS 名称', JSON.stringify(r.data.names) === JSON.stringify(['青禾鲫', '河虾', '黄昏鱼']), JSON.stringify(r.data.names));
  check('T8 三种鱼售价 30/20/45G', JSON.stringify(r.data.prices) === JSON.stringify([30, 20, 45]), JSON.stringify(r.data.prices));
  check('T8 特殊鱼 ITEM_DEFS 名称', JSON.stringify(r.data.names2) === JSON.stringify(['河鳗', '鲤鱼', '大青鱼']), JSON.stringify(r.data.names2));
  check('T8 特殊鱼售价 60/35/90G', JSON.stringify(r.data.prices2) === JSON.stringify([60, 35, 90]), JSON.stringify(r.data.prices2));

  // ── 会话 2：18:00 黄昏鱼逻辑 + 实际收获 ──
  await enterTown(18);
  const r2 = await runDuskSession();
  if (r2.__error) throw new Error(`黄昏鱼会话崩于: ${r2.__error}\n${r2.stack}`);
  check('T8 pickCurrentFish：18:00+低随机 → 大青鱼（黄昏）', r2.pickBig === 'big_blue_fish', `got=${r2.pickBig}`);
  check('T8 pickCurrentFish：18:00+中随机 → 黄昏鱼', r2.pickDusk === 'dusk_fish', `got=${r2.pickDusk}`);
  check('T8 黄昏鱼实际收获入背包 +1', r2.invDusk === 1, `count=${r2.invDusk}`);

  // ── 会话 3：20:00 河鳗 ──
  await enterTown(20);
  const r3 = await runNightSession();
  if (r3.__error) throw new Error(`夜间会话崩于: ${r3.__error}\n${r3.stack}`);
  check('T8 pickCurrentFish：20:00+低随机 → 河鳗（夜间）', r3.pickEel === 'river_eel', `got=${r3.pickEel}`);

  // T7 无运行时错误 + 失败反馈（两种失败原因都正确识别并清掉收竿提示）
  const realErrors = errors.filter((e) => !/favicon|404/.test(e));
  check('T7 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  check('T7 过早失败(early)清除收竿提示', r.t4?.reelHintCleared === true, `reelHintCleared=${r.t4?.reelHintCleared}`);
  check('T7 超时失败(timeout)清除收竿提示', r.t5?.reelHintCleared === true, `reelHintCleared=${r.t5?.reelHintCleared}`);
  check('T7 两种失败原因均结束为 fail 状态', r.t4?.fail === 'fail' && r.t5?.fail === 'fail', `t4=${r.t4?.fail} t5=${r.t5?.fail}`);

  await page.screenshot({ path: join(SHOT_DIR, 'fishing-01-spot.png') });
  console.log(`\n===== probe-fishing-phase1 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-fishing-phase1 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
