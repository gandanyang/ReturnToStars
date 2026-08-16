/**
 * probe-gathering.mjs — 生活采集 Phase 1 探针（逻辑层驱动版）
 *
 * 验证（《归星物语》生活采集与探索收集系统设计 v0.1 §六/§十三/§十五）：
 *   T1 采集点定义：forest 4 / town 3 / farm 3 / house 0；forest 4 个 kind 各异
 *   T2 setupGatherPoints 视觉创建：4 个容器，初始 collected=false
 *   T3 靠近提示：模拟玩家走到采集点附近 → nearestGatherIdx=0 + DOM hint 显示 + 文案
 *   T4 采集闭环：tryGatherInteract → true / 节点 collected=true / hint 隐藏 / 浮字"采到了 XX。"
 *                背包对应物品 +1 / getSfxLog 含 'gather'
 *   T5 一次性守卫：已采点再次 tryGatherInteract → false，背包不增加（triggerOnce 持久化）
 *   T6 持久化：hasTriggered(gatherEventKey) === true
 *   T7 第二个采集点重复闭环：换一个未采点 → 同样成功 + 背包对应物品 +1
 *   T8 出售闭环：sellAllSellable() 后金币增加（采集物 → 金币回路）
 *   T9 无运行时错误
 *
 * 驱动方式（参照 probe-fishing-phase1.mjs）：
 *   - 在真实 forest 场景实例上同步直调方法（TS private 运行时可达）
 *   - 通过修改 player 位置模拟"靠近采集点"
 *   - 背包数量直接读 Inventory.getItemCount（不依赖 DOM 解析，更稳定）
 *
 * 依赖：dev server localhost:5173；真实 Chromium。
 * 运行：node tests/probes/probe-gathering.mjs
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

/** 进入 forest 场景（种子存档 → reload → Enter → 等场景就绪） */
async function enterForest() {
  const save = {
    version: '0.5', savedAt: 'gathering-probe', timestamp: Date.now(),
    player: { x: 100, y: 200, scene: 'forest', facing: 'down', inventory: {} },
    world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
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
    if (sc === 'forest') break;
  }
  await sleep(2000);
}

/** 会话主序列：在真实 forest 场景实例上同步直调方法 */
async function runMainSequence() {
  return page.evaluate(async () => {
    const out = {};
    try {
      const s = window.__game.scene.getScene('forest');
      // 清掉对话浮字，避免污染断言
      const clearText = () => {
        if (s.dialogueText) { s.dialogueText.destroy(); s.dialogueText = null; }
      };
      if (s.storyDialogue?.isOpen?.()) s.storyDialogue.reset?.();

      // 动态 import 静态数据（仅读结构定义：Gathering 点位表；不读背包/事件实例——
      // 背包计数/triggerOnce 状态一律走 window.debug（主实例），
      // 避免 Vite dev 双模块分裂：主 bundle 写入 vs 动态 import ?t= 副本读取不一致）
      const g = await import('/src/data/Gathering.ts');
      const eco = await import('/src/data/Economy.ts');
      const audio = await import('/src/systems/AudioSystem.ts');
      // 主实例背包/事件 API（探针统一入口，与 probe-rain-snail/probe-action-time 同范式）
      const getCount = (item) => window.debug.getItemCount(item);
      const hasEvt = (key) => window.debug.events.hasTriggered(key);
      const sellAll = () => {
        // 出售走主实例 Economy（探针无法经 debug 直达 → 在主实例上经 scene? 无；
        // 改用 coin 差值判定：debug 无 sell API，保留主实例 Economy 引用)
        return eco.sellAllSellable();
      };

      // ── T1 采集点定义 ──
      out.defs = {
        forestCount: g.getGatherPointsForScene('forest').length,
        townCount: g.getGatherPointsForScene('town').length,
        farmCount: g.getGatherPointsForScene('farm').length,
        houseCount: g.getGatherPointsForScene('house').length,
        forestKinds: g.getGatherPointsForScene('forest').map(p => p.kind),
        forestIds: g.getGatherPointsForScene('forest').map(p => p.id),
      };

      // ── T2 setupGatherPoints 视觉创建（在 create 中已执行） ──
      out.setup = {
        nodesLen: s.gatherNodes.length,
        allNotCollected: s.gatherNodes.every(n => !n.collected),
        allHaveContainer: s.gatherNodes.every(n => !!n.container),
      };

      if (s.gatherNodes.length === 0) throw new Error('gatherNodes 为空，setupGatherPoints 未执行');

      // ── T3 靠近提示：模拟玩家走到第一个采集点附近 ──
      const target = s.gatherNodes[0];
      out.target = {
        id: target.def.id, kind: target.def.kind,
        x: target.def.x, y: target.def.y,
      };
      s.player.x = target.def.x + 8;
      s.player.y = target.def.y + 4;
      s.checkGatherHint();
      out.hint = {
        nearestIdx: s.nearestGatherIdx,
        hintShown: !!s.gatherInteractHint,
        hintText: s.gatherInteractHint?.textContent ?? null,
      };

      // ── T4 采集闭环 ──
      const itemId = g.gatherKindToItem(target.def.kind);
      out.before = {
        count: getCount(itemId),
        coins: eco.getCoins(),
      };
      // 清空 sfxLog（避免被前序操作污染）
      // getSfxLog 返回尾部 64 条，无法清空；改为记录调用前后长度差
      const sfxLenBefore = audio.getSfxLog().length;
      const ret = s.tryGatherInteract();
      out.gather = {
        ret,
        nodeCollected: s.gatherNodes[0]?.collected,
        hintHidden: !s.gatherInteractHint,
        textShown: s.dialogueText?.text ?? null,
      };
      // 视觉淡出 0.4s，等结束
      await new Promise(r => setTimeout(r, 500));
      const sfxLogAfter = audio.getSfxLog();
      out.after = {
        count: getCount(itemId),
        coins: eco.getCoins(),
        sfxTail: sfxLogAfter.slice(-5),
        sfxIncludesGather: sfxLogAfter.slice(sfxLenBefore).includes('gather'),
      };

      // ── T5 一次性守卫：再次 tryGatherInteract 应返回 false ──
      out.guard = {
        ret: s.tryGatherInteract(),
        countAfter2nd: getCount(itemId),
      };

      // ── T6 持久化：hasTriggered === true（主实例事件状态） ──
      out.persisted = hasEvt(g.gatherEventKey('forest', target.def.id));

      // ── T7 第二个采集点重复闭环 ──
      if (s.gatherNodes.length >= 2) {
        clearText();
        const t2 = s.gatherNodes[1];
        s.player.x = t2.def.x + 6;
        s.player.y = t2.def.y + 3;
        s.checkGatherHint();
        const item2Id = g.gatherKindToItem(t2.def.kind);
        const count2Before = getCount(item2Id);
        const ret2 = s.tryGatherInteract();
        await new Promise(r => setTimeout(r, 500));
        out.second = {
          ret: ret2,
          nearestIdxWas1: s.nearestGatherIdx, // 已被 tryGatherInteract 置 -1
          count2Before,
          count2After: getCount(item2Id),
          nodeCollected: s.gatherNodes[1]?.collected,
          textShown: s.dialogueText?.text ?? null,
        };
      }

      // ── T8 出售闭环：sellAllSellable 后金币增加 ──
      const coinsBeforeSell = eco.getCoins();
      const sellResult = eco.sellAllSellable();
      out.sell = {
        coinsBeforeSell,
        coinsAfterSell: eco.getCoins(),
        sellResultTotal: sellResult?.totalCoins ?? 0,
        soldCount: sellResult?.sold?.length ?? 0,
      };

      return out;
    } catch (e) {
      return { __error: e.message, stack: e.stack ?? '' };
    }
  });
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);

  await enterForest();
  const r = await runMainSequence();
  if (r.__error) throw new Error(`主序列崩于: ${r.__error}\n${r.stack}`);

  console.log('defs:', JSON.stringify(r.defs));
  console.log('setup:', JSON.stringify(r.setup));
  console.log('target:', JSON.stringify(r.target));
  console.log('hint:', JSON.stringify(r.hint));
  console.log('gather:', JSON.stringify(r.gather));
  console.log('after:', JSON.stringify(r.after));
  console.log('guard:', JSON.stringify(r.guard));
  console.log('persisted:', JSON.stringify(r.persisted));
  if (r.second) console.log('second:', JSON.stringify(r.second));
  console.log('sell:', JSON.stringify(r.sell));

  // ── T1 采集点定义 ──
  check('T1 forest 采集点 4 个', r.defs.forestCount === 4, `got=${r.defs.forestCount}`);
  check('T1 town 采集点 3 个', r.defs.townCount === 3, `got=${r.defs.townCount}`);
  check('T1 farm 采集点 3 个', r.defs.farmCount === 3, `got=${r.defs.farmCount}`);
  check('T1 house 场景无采集点', r.defs.houseCount === 0, `got=${r.defs.houseCount}`);
  check('T1 forest 4 个 kind 涵盖 mushroom/twig/flower 三种',
    new Set(r.defs.forestKinds).size >= 3 &&
    r.defs.forestKinds.includes('wild_mushroom') &&
    r.defs.forestKinds.includes('twig') &&
    r.defs.forestKinds.includes('small_flower'),
    JSON.stringify(r.defs.forestKinds));

  // ── T2 setupGatherPoints 视觉创建 ──
  check('T2 setupGatherPoints 创建 4 个视觉容器', r.setup.nodesLen === 4, `len=${r.setup.nodesLen}`);
  check('T2 所有点初始未采', r.setup.allNotCollected === true, '');
  check('T2 所有容器存在', r.setup.allHaveContainer === true, '');

  // ── T3 靠近提示 ──
  check('T3 靠近采集点 → nearestGatherIdx = 0', r.hint.nearestIdx === 0, `idx=${r.hint.nearestIdx}`);
  check('T3 DOM hint 显示', r.hint.hintShown === true, '');
  check('T3 hint 文案正确（PC：按 [E] 采集）', r.hint.hintText === '按 [E] 采集', `text=${r.hint.hintText}`);

  // ── T4 采集闭环 ──
  check('T4 tryGatherInteract 返回 true', r.gather.ret === true, `ret=${r.gather.ret}`);
  check('T4 节点标记 collected=true', r.gather.nodeCollected === true, '');
  check('T4 DOM hint 隐藏', r.gather.hintHidden === true, '');
  check('T4 浮字以"采到了"开头', r.gather.textShown?.startsWith('采到了') === true, `text=${r.gather.textShown}`);
  check('T4 背包对应物品 +1', r.after.count === r.before.count + 1, `before=${r.before.count} after=${r.after.count}`);
  check('T4 音效 gather 已播放', r.after.sfxIncludesGather === true, JSON.stringify(r.after.sfxTail));

  // ── T5 一次性守卫 ──
  check('T5 已采点再次 tryGatherInteract → false', r.guard.ret === false, `ret=${r.guard.ret}`);
  check('T5 重复调用不增加背包', r.guard.countAfter2nd === r.after.count, `count=${r.guard.countAfter2nd}`);

  // ── T6 持久化 ──
  check('T6 hasTriggered = true（标记落库）', r.persisted === true, '');

  // ── T7 第二个采集点闭环 ──
  if (r.second) {
    check('T7 第二采集点 tryGatherInteract → true', r.second.ret === true, `ret=${r.second.ret}`);
    check('T7 第二采集点 collected=true', r.second.nodeCollected === true, '');
    check('T7 第二采集点背包 +1', r.second.count2After === r.second.count2Before + 1, `before=${r.second.count2Before} after=${r.second.count2After}`);
    check('T7 第二采集点浮字正确', r.second.textShown?.startsWith('采到了') === true, `text=${r.second.textShown}`);
  } else {
    check('T7 第二采集点（无第二点，跳过）', false, 'gatherNodes < 2');
  }

  // ── T8 出售闭环 ──
  check('T8 出售后金币增加', r.sell.coinsAfterSell > r.sell.coinsBeforeSell, `before=${r.sell.coinsBeforeSell} after=${r.sell.coinsAfterSell}`);
  check('T8 sellAllSellable 返回总金额 > 0', r.sell.sellResultTotal > 0, `total=${r.sell.sellResultTotal}`);

  // ── T9 无运行时错误 ──
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T9 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: join(SHOT_DIR, 'gathering-01-forest.png') });
  console.log(`\n===== probe-gathering 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-gathering 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
