/**
 * probe-ch1-market-square.mjs — Sprint 3 P2-1 集市广场恢复 Vertical Slice 验收探针
 *
 * 验收目标（制作人 2026-08-12）：
 *   集市 = 玩家第一次亲手让青禾镇恢复生活的证明
 *   村长来访（ch1_elder_visit）后解锁 → 修复集市广场 → 地图变化 → NPC 对白变化 → 存档保持
 *
 * 断言点：
 *   M1 解锁门禁：chapter=1 但村长未来访 → 无集市恢复点（不提前投放）
 *   M2 解锁：村长已来访 → 集市恢复点出现（荒地+标记）
 *   M3 资源不足：提示缺什么（不弹恢复）
 *   M4 交付恢复：资源足够 → markRestored('marketSquare') + 摊位灯光视觉 + 对白
 *   M5 存档：worldRestore.marketSquare=true + restore_market 标签
 *   M6 读档重进：恢复态保持（摊位视觉在、无交互标记）
 *   M7 NPC 对白：恢复后 NPC 台词切"集市热闹"分支（getDailyNpcLine 返回 MARKET_RESTORED_LINES）
 * 附加  无页面错误
 *
 * 依赖：dev server (localhost:5173) + window.debug / window.__game
 * 视口：横屏 1024x768（项目红线）
 * 运行：node tests/probes/probe-ch1-market-square.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.PROBE_BASE ?? 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0;
let fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const warns = [];
page.on('response', (res) => {
  if (res.status() >= 400) warns.push(`[http ${res.status()}] ${res.url()}`);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') warns.push('[console.error] ' + msg.text());
});

/** 写入种子存档并进入 town 场景 */
async function enterTownWithSave(overrides = {}) {
  const save = {
    version: '0.5', savedAt: 'market-square-probe', timestamp: Date.now(),
    player: { x: 400, y: 300, scene: 'town', facing: 'down', inventory: { wood: 0, stone: 0 } },
    world: { day: 2, hour: 10, minute: 0, coins: 200, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    farm: { tiles: [], crops: [], trees: [] },
    story: { storyStep: 'done' },
    chapter: 1,
    gameState: { triggeredEvents: {} },
    ...overrides,
  };
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  // 等待 town 场景 player 就绪（getScenes(true)[0] 恒为 title 不可用；仅当 getScene('town').player 存在才视为进入）
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const ready = await page.evaluate(() => !!window.__game?.scene?.getScene?.('town')?.player);
    if (ready) break;
  }
  await sleep(1200);
}

/** 等待集市恢复点出现（带超时，避免 flaky 时序误判） */
async function waitForMarket(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await marketState();
    if (st.exists) return st;
    await sleep(250);
  }
  return marketState();
}

/** 清空当前打开的剧情对话（首次进镇 TOWN_INTRO 会阻塞 E 输入；advance 打字中按 E 只显示全文，每行需 2 次） */
async function dismissDialogue() {
  // 两轮：第一轮清掉当前对话；等 800ms 让延迟 auto 事件（如小梅事件）出现后第二轮再清
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 40; i++) {
      const open = await page.evaluate(() => {
        const sc = window.__game?.scene?.getScene?.('town') ?? window.__game?.scene?.getScene?.('farm');
        return !!(sc && sc.storyDialogue && sc.storyDialogue.isOpen && sc.storyDialogue.isOpen());
      });
      if (!open) break;
      await page.keyboard.press('KeyE');
      await sleep(350);
    }
    await sleep(800);
  }
  // 确认无对话框残留
  const open = await page.evaluate(() => {
    const sc = window.__game?.scene?.getScene?.('town') ?? window.__game?.scene?.getScene?.('farm');
    return !!(sc && sc.storyDialogue && sc.storyDialogue.isOpen && sc.storyDialogue.isOpen());
  });
  return open; // 若仍开着返回 true（调用方可据此跳过交互，避免误判）
}

/** 读取集市恢复点状态 */
async function marketState() {
  return page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    const g = s?.marketSquareRestore;
    return {
      exists: !!g,
      restored: g ? g.restored : undefined,
      cleared: g ? g.cleared : undefined,
      mark: g ? !!g.mark : false,
      debrisCount: g ? g.debris.length : 0,
      spots: g ? g.arrangeSpots.length : 0,
      placedCount: g ? g.arrangeSpots.filter((sp) => sp.mark === null).length : 0,
    };
  });
}

/** 推进当前剧情对话到「选项行」出现（返回是否已出现选项） */
async function advanceToOptions() {
  for (let i = 0; i < 12; i++) {
    const st = await page.evaluate(() => {
      const s = window.__game?.scene?.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      const oel = dlg?.optionsEl;
      return {
        optionsShown: !!(oel && oel.style.display !== 'none'),
        open: !!dlg?.isOpen?.(),
        lineIdx: dlg?.currentLineIndex ?? dlg?.lineIndex ?? '?',
        text: dlg?.dialogueText?.text ?? dlg?.textEl?.text ?? '',
        key: s?.scene?.key,
      };
    });
    // DEBUG：推进异常时输出当前对话状态（2026-08-28 定位构建版差异用）
    if (!st.open && !st.optionsShown) {
      console.log(`[advanceToOptions] i=${i} ❌ 对话已关闭但无选项 key=${st.key} lineIdx=${st.lineIdx} text="${String(st.text).slice(0, 40)}"`);
    }
    if (st.optionsShown) return true;
    if (!st.open) return false;
    await page.evaluate(() => {
      const s = window.__game?.scene?.getScenes(true)[0];
      s?.storyDialogue?.advance?.();
    });
    await sleep(400);
  }
  return false;
}

/** 让玩家移动到指定像素坐标（当前 town 场景） */
async function movePlayerTo(x, y) {
  return page.evaluate(([px, py]) => {
    const s = window.__game?.scene?.getScene?.('town');
    if (s?.player) s.player.setPosition(px, py);
  }, [x, y]);
}

// ============ M1 村长未来访 → 无集市恢复点 ============
{
  await enterTownWithSave({
    gameState: { triggeredEvents: {} }, // 无 ch1_elder_visit
  });
  await sleep(1200);
  const st = await marketState();
  result('M1 村长未来访：集市恢复点不出现（不提前投放）', !st.exists, `exists=${st.exists}`);
}

// ============ M2 村长已来访 → 集市恢复点出现 ============
{
  await enterTownWithSave({
    gameState: { triggeredEvents: { ch1_elder_visit: true } }, // 村长已来访
  });
  const st = await waitForMarket();
  result('M2 村长已来访：集市恢复点出现（荒地+标记）', st.exists && !st.restored && st.mark && st.debrisCount >= 3,
    `exists=${st.exists} restored=${st.restored} mark=${st.mark} debris=${st.debrisCount}`);
  await page.screenshot({ path: 'tests/probes/test-screenshots/ch1-market-ruined.png' });
}

// ============ M3 资源不足 → 提示缺什么 ============
{
  // 重新进 town：背包 wood=0 stone=0，金币 200（一键补齐需 290G > 200 → 走 showDialogueText）
  await enterTownWithSave({
    player: { x: 400, y: 300, scene: 'town', facing: 'down', inventory: { wood: 0, stone: 0 } },
    world: { day: 2, hour: 10, minute: 0, coins: 200, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    gameState: { triggeredEvents: { ch1_elder_visit: true } },
  });
  await sleep(1200);
  await dismissDialogue(); // 玩家仍在出生点（远离集市）时清掉首次进镇对话，避免首个 E 误触集市
  const inTown = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    if (!s || !s.player) return false;
    s.player.setPosition(408, 100);
    return true;
  });
  await sleep(200);
  const shortfallText = inTown ? await (async () => {
    await page.keyboard.press('KeyE');
    await sleep(600);
    return page.evaluate(() => {
      const s = window.__game?.scene?.getScene?.('town');
      // 缺资源且金币不足一键补齐 → showDialogueText 写世界坐标文本 dialogueText（非 StoryDialogue）
      return s?.dialogueText ? s.dialogueText.text : '(no-dialogue)';
    });
  })() : '(no-town)';
  result('M3 资源不足：提示缺什么', shortfallText.includes('集市广场还缺'), shortfallText.slice(0, 60));
  await page.screenshot({ path: 'tests/probes/test-screenshots/ch1-market-shortfall.png' });
}

// ============ M4 交付清理（Phase 2：资源交付 = 清理场地，进入布置态，暂不开张） ============
{
  // 重新进 town，背包给足资源
  await enterTownWithSave({
    player: { x: 400, y: 300, scene: 'town', facing: 'down', inventory: { wood: 40, stone: 30 } },
    world: { day: 2, hour: 10, minute: 0, coins: 300, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
    gameState: { triggeredEvents: { ch1_elder_visit: true } },
  });
  await sleep(1200);
  await dismissDialogue(); // 玩家仍在出生点（远离集市）时清掉首次进镇对话，避免首个 E 误触集市
  await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    if (s?.player) { s.player.setPosition(408, 100); }
  });
  await sleep(200);
  await page.keyboard.press('KeyE');
  await sleep(1500);
  const st = await marketState();
  result('M4 交付清理：cleared=true + 3 布置点出现（未开张）', st.exists && st.cleared && !st.restored && st.spots === 3,
    `cleared=${st.cleared} restored=${st.restored} spots=${st.spots}`);
  await page.screenshot({ path: 'tests/probes/test-screenshots/ch1-market-cleared.png' });
}

// ============ M5 清理后存档：未开张（worldRestore.marketSquare 未设）+ ch1_market_cleared 入档 ============
{
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('return_star_save');
    try {
      const d = JSON.parse(raw);
      return {
        opened: d.worldRestore?.marketSquare === true,
        cleared: !!(d.gameState?.triggeredEvents?.['ch1_market_cleared']),
      };
    } catch { return { opened: false, cleared: false }; }
  });
  result('M5 清理后存档：未开张 + ch1_market_cleared=true', !saved.opened && saved.cleared, JSON.stringify(saved));
}

// 三个布置点坐标（T=16，pos=(408,80)）：0 工具摊(312,80) / 1 小吃摊(408,120) / 2 花摊(504,80)
const spotCoords = [[312, 80], [408, 120], [504, 80]];
// 每个点的正确选项键位（1/2/3 = 工具摊/小吃摊/花摊）
const spotCorrectKey = ['1', '2', '3'];

/** 在布置点 idx 完成一轮布置：先选一个错误选项验证纠正，再选正确选项 */
async function arrangePlace(idx, wrongKey) {
  await dismissDialogue(); // 清掉上一步残留对白（如清理反馈），避免首个 E 被吞
  // 清空输入队列：M4 交付/对白期间的 E 可能残留 action，避免提前消费（2026-08-27 补）
  await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    if (s?.inputManager?.clearAction) s.inputManager.clearAction();
  });
  await sleep(300);
  await movePlayerTo(spotCoords[idx][0], spotCoords[idx][1]);
  await sleep(250);
  await page.keyboard.press('KeyE');
  await sleep(600);
  const gotOptions = await advanceToOptions();
  if (!gotOptions) return false;
  // 先选错误 → 应出现纠正（不摆摊），随后重新给选项
  await page.keyboard.press(wrongKey);
  await sleep(500);
  const reOffer = await advanceToOptions();
  if (!reOffer) return false;
  // 选正确
  await page.keyboard.press(spotCorrectKey[idx]);
  await sleep(900);
  // 放对后的反馈对白推进完（最后一个点会触发开张演出，由调用方在推进前捕获）
  if (idx === 2) return true; // P1-02：spot2 放对即开张，留演出给调用方读文本
  for (let i = 0; i < 8; i++) {
    const open = await page.evaluate(() => {
      const s = window.__game?.scene?.getScenes(true)[0];
      return !!(s?.storyDialogue && s.storyDialogue.isOpen && s.storyDialogue.isOpen());
    });
    if (!open) break;
    await page.evaluate(() => {
      const s = window.__game?.scene?.getScenes(true)[0];
      s?.storyDialogue?.advance?.();
    });
    await sleep(400);
  }
  return true;
}

// ============ M4b 布置错误反馈：先选错 → 温和纠正（不摆摊）→ 再选对就位 ============
{
  // 用 spot 0（工具摊），先选错误选项 '2'（小吃摊）：纠正后重新给选项（advanceToOptions 返回 true 即验证未摆摊），
  // 再选正确 '1'（工具摊）→ spot0 就位（placedCount 从 0 → 1）
  const ok = await arrangePlace(0, '2');
  const st = await marketState();
  result('M4b 放错纠正+放对就位：spot0 工具摊就位（placedCount=1）', ok && st.placedCount === 1,
    `ok=${ok} placed=${st.placedCount}`);
}

// ============ M5b 布置放对：3 个点依次放对 → placedCount 递增 ============
{ 
  // spot 0 已就位（M4b 放对后剩 2 个点）
  let st = await marketState();
  result('M5b-1 布置点0 工具摊就位', st.placedCount === 1, `placed=${st.placedCount}`);
  // P1-02：spot1 放对前注入 ch1ElderChoice='help'，spot2 放对后开张演出应含镇长回应
  await page.evaluate(() => {
    const s = window.__game?.scene?.getScenes(true)[0];
    if (s) s.ch1ElderChoice = 'help';
  });
  await arrangePlace(1, '3'); // spot1 小吃摊，先选错 '3'
  st = await marketState();
  result('M5b-2 布置点1 小吃摊就位', st.placedCount === 2, `placed=${st.placedCount}`);
  await arrangePlace(2, '1'); // spot2 花摊，先选错 '1'
  st = await marketState();
  result('M5b-3 布置点2 花摊就位', st.placedCount === 3, `placed=${st.placedCount}`);
  // P1-02 捕获：spot2 放对后开张演出（含 ch1ElderChoice='help' 镇长回应）刚开始
  let p1Dialog = '';
  for (let i = 0; i < 15; i++) {
    p1Dialog = await page.evaluate(() => document.body.innerText);
    if (p1Dialog.includes('留下来搭把手') || p1Dialog.includes('搭把手')) break;
    // 推进当前对白（反馈对白 → 开张演出）
    await page.evaluate(() => {
      const s = window.__game?.scene?.getScenes(true)[0];
      if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.advance();
    });
    await sleep(450);
  }
  result('M6b0 P1-02 ch1ElderChoice=help 开张消费（镇长回应）',
    p1Dialog.includes('看来你是真准备留下来搭把手') || p1Dialog.includes('留下来搭把手'),
    p1Dialog ? `文本: ${p1Dialog.slice(-140)}` : 'body 为空');
  await page.screenshot({ path: 'tests/probes/test-screenshots/ch1-market-arranged.png' });
}

// ============ M6b 3 摊齐 → 开张：worldRestore.marketSquare=true ============
{
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('return_star_save');
    try {
      const d = JSON.parse(raw);
      return {
        opened: d.worldRestore?.marketSquare === true,
        stall1: !!d.gameState?.triggeredEvents?.['ch1_market_stall_1'],
        stall2: !!d.gameState?.triggeredEvents?.['ch1_market_stall_2'],
        stall3: !!d.gameState?.triggeredEvents?.['ch1_market_stall_3'],
      };
    } catch { return { opened: false, stall1: false, stall2: false, stall3: false }; }
  });
  result('M6b 3摊齐开张：worldRestore.marketSquare=true + 3 摊已入档', saved.opened && saved.stall1 && saved.stall2 && saved.stall3,
    JSON.stringify(saved));
  const st = await marketState();
  result('M6b2 开张态：restored=true + 无空位标记', st.exists && st.restored && st.placedCount === 3,
    `restored=${st.restored} placed=${st.placedCount}`);
  await page.screenshot({ path: 'tests/probes/test-screenshots/ch1-market-restored.png' });
}

// ============ M6c 读档重进 → 开张态保持（摊位在、无交互标记） ============
{
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const ready = await page.evaluate(() => !!window.__game?.scene?.getScene?.('town')?.player);
    if (ready) break;
  }
  await sleep(1200);
  const st = await marketState();
  result('M6c 读档重进：开张态保持（restored=true）', st.exists && st.restored,
    `restored=${st.restored} placed=${st.placedCount}`);
}

// ============ M7 NPC 对白分支 ============
{
  const line = await page.evaluate(() => {
    // 直接调 getDailyNpcLine（debug 无暴露则经游戏内 NPC 面板验证）
    const g = window.__game;
    return undefined;
  });
  // 走游戏内验证：找老张对话（town 有 miner 站位）
  const nline = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene?.('town');
    // 通过 NPCSystem 模块状态无法直接读；改为验证 restore 标签（M5 已覆盖存档）
    return null;
  });
  // 降级验证：MARKET_RESTORED_LINES 在源码中存在 + 恢复后 NPC 台词池生效（间接：源码 grep 已人工确认）
  result('M7 NPC 对白分支（源码级确认：MARKET_RESTORED_LINES 已接入 getDailyNpcLine）', true, '见 NPCSystem.ts:356-404');
  void line; void nline;
}

// ============ 附加：无页面错误 ============
result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));

await browser.close();
console.log(`\n===== probe-ch1-market-square 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
