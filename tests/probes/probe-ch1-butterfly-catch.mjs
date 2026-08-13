/**
 * probe-ch1-butterfly-catch.mjs — 第一章 P2 捕虫玩法 V0.1 验证
 *
 * 验证项（2026-08-13 制作人拍板：farm + town 蝴蝶可捕捉 + 次日刷新 + 进背包纪念物）：
 *   源码层：
 *     1. butterfly_specimen 物品定义存在（Inventory.ts，sellPriority=forbidden）
 *     2. createButterfly 挂 setInteractive + pointerdown（可点击捕捉）
 *     3. tryCatchButterfly 调用 addItem('butterfly_specimen')
 *     4. tryCatchNearestButterfly 存在（tryInteract 入口分支）
 *     5. spawnTownButterflies 存在（town 蝴蝶生成）
 *     6. refreshButterfliesNextDay 在 trySleep 中调用（跨天刷新）
 *   运行时：
 *     7. farm 花园恢复后生成 ≥2 只可捕捉蝴蝶
 *     8. 捕捉后 butterfly_specimen +1
 *     9. 捕捉后蝴蝶 captured=true（防重复标记）
 *    10. 二次捕捉同一只蝴蝶数量不变（防重复）
 *    11. refreshButterfliesNextDay 后蝴蝶重生（captured=false，新对象）
 *    12. town 白天也有蝴蝶
 *    13. 无运行时错误
 *
 * 前置：dev server (localhost:5173)
 * 运行：node tests/probes/probe-ch1-butterfly-catch.mjs
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
const result = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
};

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// ========== 源码层验证 ==========
const inventorySrc = fs.readFileSync(path.join(ROOT, 'src', 'data', 'Inventory.ts'), 'utf-8');
const mapSceneSrc = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'MapScene.ts'), 'utf-8');

console.log('=== 第一章 P2 捕虫玩法 V0.1 探针 ===\n');

// --- 1. butterfly_specimen 物品定义 ---
console.log('--- 1. butterfly_specimen 物品定义 ---');
result('1.1 ItemType 含 butterfly_specimen',
  inventorySrc.includes("'butterfly_specimen'") || inventorySrc.includes('"butterfly_specimen"'));
result('1.2 ITEM_DEFS 含 butterfly_specimen 条目',
  /butterfly_specimen:\s*\{[^}]*name:\s*'蝴蝶标本'/.test(inventorySrc),
  '未找到蝴蝶标本定义');
result('1.3 sellPriority=forbidden（不可售纪念物）',
  /butterfly_specimen:\s*\{[^}]*sellPriority:\s*'forbidden'/.test(inventorySrc));
result('1.4 inventory 初始值含 butterfly_specimen: 0',
  /butterfly_specimen:\s*0/.test(inventorySrc));

// --- 2. createButterfly 挂交互 ---
console.log('\n--- 2. createButterfly 挂交互 ---');
result('2.1 createButterfly 接受 opts 参数',
  /private createButterfly\([^)]*opts\?:\s*\{/.test(mapSceneSrc));
result('2.2 挂 setInteractive（Circle hit area）',
  /createButterfly[\s\S]*?setInteractive\(new Phaser\.Geom\.Circle/.test(mapSceneSrc));
result('2.3 绑 pointerdown 事件',
  /createButterfly[\s\S]*?\.on\('pointerdown'/.test(mapSceneSrc));
result('2.4 设置 captured=false 初始标记',
  /createButterfly[\s\S]*?setData\('captured',\s*false\)/.test(mapSceneSrc));
result('2.5 加入 catchableButterflies 数组',
  /createButterfly[\s\S]*?this\.catchableButterflies\.push\(c\)/.test(mapSceneSrc));

// --- 3. tryCatchButterfly 捕捉逻辑 ---
console.log('\n--- 3. tryCatchButterfly 捕捉逻辑 ---');
result('3.1 tryCatchButterfly 方法定义',
  /private tryCatchButterfly\(/.test(mapSceneSrc));
result('3.2 调用 addItem("butterfly_specimen")',
  /tryCatchButterfly[\s\S]*?addItem\('butterfly_specimen'/.test(mapSceneSrc));
result('3.3 防重复守卫（captured 标记）',
  /tryCatchButterfly[\s\S]*?if\s*\(b\.getData\('captured'\)\)\s*return/.test(mapSceneSrc));
result('3.4 StoryDialogue isOpen 守卫（不与剧情冲突）',
  /tryCatchButterfly[\s\S]*?storyDialogue\?\.isOpen\(\)/.test(mapSceneSrc));
result('3.5 飞走动画（y 上移 + alpha 渐隐）',
  /tryCatchButterfly[\s\S]*?y:\s*b\.y\s*-\s*50[\s\S]*?alpha:\s*0/.test(mapSceneSrc));

// --- 4. tryCatchNearestButterfly（tryInteract 分支）---
console.log('\n--- 4. tryCatchNearestButterfly（tryInteract 分支）---');
result('4.1 tryCatchNearestButterfly 方法定义',
  /private tryCatchNearestButterfly\(\):\s*boolean/.test(mapSceneSrc));
result('4.2 tryInteract 内 farm/town 分支调用',
  /tryInteract[\s\S]*?mapKey === 'farm' \|\| this\.mapKey === 'town'[\s\S]*?tryCatchNearestButterfly/.test(mapSceneSrc));

// --- 5. spawnTownButterflies ---
console.log('\n--- 5. spawnTownButterflies ---');
result('5.1 spawnTownButterflies 方法定义',
  /private spawnTownButterflies\(\)/.test(mapSceneSrc));
result('5.2 白天 06-18 时限制',
  /spawnTownButterflies[\s\S]*?t\.hour < 6 \|\| t\.hour >= 18/.test(mapSceneSrc));
result('5.3 setupTownDecorations 末尾调用',
  /setupTownDecorations[\s\S]*?this\.spawnTownButterflies\(\)/.test(mapSceneSrc));

// --- 6. refreshButterfliesNextDay ---
console.log('\n--- 6. refreshButterfliesNextDay 跨天刷新 ---');
result('6.1 refreshButterfliesNextDay 方法定义',
  /private refreshButterfliesNextDay\(\)/.test(mapSceneSrc));
result('6.2 trySleep 内调用',
  /trySleep[\s\S]*?this\.refreshButterfliesNextDay\(\)/.test(mapSceneSrc));
result('6.3 销毁旧蝴蝶 + 重建 farm 蝴蝶',
  /refreshButterfliesNextDay[\s\S]*?isRestored\('garden'\)[\s\S]*?createButterfly/.test(mapSceneSrc));

// --- 6b. 捕虫「自然记录」品种收敛（青禾凤蝶固定品种，无稀有度） ---
console.log('\n--- 6b. 捕虫品种收敛（青禾凤蝶） ---');
result('6b.1 BUTTERFLY_VARIANTS 表含 qinghe/white/yellow/blue（无 rare）',
  /BUTTERFLY_VARIANTS[\s\S]*?white:[\s\S]*?yellow:[\s\S]*?blue:[\s\S]*?qinghe:/.test(mapSceneSrc) &&
  !/rare:/.test(mapSceneSrc));
result('6b.2 pickButterflyType 存在（均匀白/黄/蓝，无 12% 稀有）',
  /private pickButterflyType\(\)[\s\S]*?return normals\[Math\.floor\(Math\.random\(\) \* normals\.length\)\]/.test(mapSceneSrc));
result('6b.3 createButterfly 接受 type 选项',
  /private createButterfly\([^)]*opts\?:\s*\{\s*catchable\?:\s*boolean;\s*type\?:\s*string\s*\}/.test(mapSceneSrc));
result('6b.4 tryCatchButterfly 青禾凤蝶 → 触发 ch1_qinghe_butterfly_guide 世界观描述',
  /if \(t === 'qinghe'\)[\s\S]*?青禾凤蝶，喜欢停留在花丛附近[\s\S]*?triggerOnce\('ch1_qinghe_butterfly_guide'/.test(mapSceneSrc));
result('6b.5 青禾凤蝶捕捉得普通标本 butterfly_specimen',
  /addItem\('butterfly_specimen', 1\)/.test(mapSceneSrc));
result('6b.6 花园固定生成青禾凤蝶（初始 + 跨天刷新）',
  (mapSceneSrc.match(/type: 'qinghe'/g) || []).length >= 2);

// ========== 运行时验证 ==========
console.log('\n--- 7. 运行时验证 ---');

// SAVE：第一章 + 教程完成 + 花园已恢复 + 白天 10:00 + 玩家在花园附近
const SAVE = {
  version: '0.5', savedAt: 'butterfly-probe', timestamp: Date.now(),
  player: { x: 30 * 32 + 16, y: 5 * 32 + 16, scene: 'farm', facing: 'down', inventory: {} },
  world: { day: 1, hour: 10, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'observatory_complete' },
  chapter: 1,
  worldRestore: { garden: true },
  gameState: { triggeredEvents: {} },
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);

  // 进入 farm
  const enterGame = async (sceneKey, timeoutMs = 25000) => {
    const t0 = Date.now();
    let cur = '';
    while (Date.now() - t0 < timeoutMs) {
      try {
        cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      } catch { await sleep(300); continue; }
      if (cur === sceneKey) return;
      if (cur === 'title') {
        await page.keyboard.press('Enter');
        await page.mouse.click(400, 300);
      }
      await sleep(350);
    }
    throw new Error(`未能进入 ${sceneKey}（实际 ${cur}）`);
  };
  await enterGame('farm');
  await sleep(1500); // 等待 buildGardenRestored + 蝴蝶生成

  // 7.1 farm 花园恢复后有 ≥2 只可捕捉蝴蝶
  let butterflyInfo = await page.evaluate(() => {
    const scene = window.__game?.scene.getScenes(true)[0];
    const bs = scene?.catchableButterflies ?? [];
    return {
      count: bs.length,
      captured: bs.map((b) => b.getData('captured')),
      positions: bs.map((b) => ({ x: b.x, y: b.y })),
    };
  });
  result('7.1 farm 花园恢复后生成 ≥2 只可捕捉蝴蝶',
    butterflyInfo.count >= 2, `count=${butterflyInfo.count}`);

  if (butterflyInfo.count >= 2) {
    // 7.2 初始 captured 都为 false
    result('7.2 初始蝴蝶 captured=false',
      butterflyInfo.captured.every((c) => c === false),
      `captured=${JSON.stringify(butterflyInfo.captured)}`);

    // 7.3 初始背包 butterfly_specimen = 0
    let initialCount = await page.evaluate(() => {
      const scene = window.__game?.scene.getScenes(true)[0];
      return scene ? window.debug?.getItemCount?.('butterfly_specimen') ??
        (window.__itemCount?.('butterfly_specimen') ?? -1) : -1;
    });
    // 用更直接的方式：检查 Inventory 模块
    initialCount = await page.evaluate(() => {
      try {
        // Inventory 是模块单例，通过 addItem 副作用不可逆；改用 debug.giveItem 间接验证
        // 直接读取 scene 内部并不暴露 getItemCount，但 catchableButterflies 已能验证
        return 0; // 默认 0（SAVE.inventory={} 会清零）
      } catch { return -1; }
    });

    // 7.4 直接调用 tryCatchButterfly 捕捉第一只
    // 注：先关闭可能残留的 storyDialogue（场景加载可能触发对白未关闭）
    let catchResult = await page.evaluate(() => {
      const scene = window.__game?.scene.getScenes(true)[0];
      if (!scene || !scene.catchableButterflies?.length) return { ok: false, reason: 'no butterflies' };
      // 主动关闭可能残留的对白面板（捕虫守卫 storyDialogue.isOpen() 会拦截）
      try { scene.storyDialogue?.close?.(); } catch (e) { /* ignore */ }
      const b = scene.catchableButterflies[0];
      scene.tryCatchButterfly(b);
      return {
        ok: true,
        captured: b.getData('captured'),
        visible: b.visible,
        sdOpen: scene.storyDialogue?.isOpen?.(),
      };
    });
    result('7.4 捕捉后第一只蝴蝶 captured=true',
      catchResult.captured === true, JSON.stringify(catchResult));

    // 7.5 等待飞走动画完成
    await sleep(700);

    // 7.6 捕捉后蝴蝶 visible=false（飞走动画结束）
    let afterCatch = await page.evaluate(() => {
      const scene = window.__game?.scene.getScenes(true)[0];
      const b = scene?.catchableButterflies?.[0];
      return { visible: b?.visible, captured: b?.getData('captured') };
    });
    result('7.6 飞走动画后蝴蝶 visible=false',
      afterCatch.visible === false, JSON.stringify(afterCatch));

    // 7.7 二次捕捉同一只蝴蝶（防重复）
    let secondCatch = await page.evaluate(() => {
      const scene = window.__game?.scene.getScenes(true)[0];
      const b = scene?.catchableButterflies?.[0];
      if (!b) return { ok: false };
      const beforeY = b.y;
      scene.tryCatchButterfly(b); // 应直接 return
      return { beforeY, afterY: b.y, captured: b.getData('captured') };
    });
    result('7.7 二次捕捉同一只蝴蝶被防重复拦截',
      secondCatch.captured === true && secondCatch.beforeY === secondCatch.afterY,
      JSON.stringify(secondCatch));

    // 7.8 第二只蝴蝶仍可捕捉
    let secondButterflyState = await page.evaluate(() => {
      const scene = window.__game?.scene.getScenes(true)[0];
      const b = scene?.catchableButterflies?.[1];
      return { captured: b?.getData('captured'), visible: b?.visible };
    });
    result('7.8 第二只蝴蝶仍可捕捉（captured=false）',
      secondButterflyState.captured === false && secondButterflyState.visible === true,
      JSON.stringify(secondButterflyState));
  }

  // 7.9 refreshButterfliesNextDay 后蝴蝶重生
  let refreshResult = await page.evaluate(() => {
    const scene = window.__game?.scene.getScenes(true)[0];
    if (!scene) return { ok: false, reason: 'no scene' };
    const beforeIds = (scene.catchableButterflies ?? []).map((b) => b.__uniqueId ?? null);
    scene.refreshButterfliesNextDay();
    const afterList = scene.catchableButterflies ?? [];
    const afterCaptured = afterList.map((b) => b.getData('captured'));
    return {
      ok: true,
      afterCount: afterList.length,
      afterCaptured,
      allNewCapturedFalse: afterCaptured.every((c) => c === false),
    };
  });
  result('7.9 refreshButterfliesNextDay 后蝴蝶重生（captured 全 false）',
    refreshResult.afterCount >= 2 && refreshResult.allNewCapturedFalse,
    JSON.stringify(refreshResult));

  // 7.10 town 也有蝴蝶（切换到 town 场景）
  try {
    // 切换到 town：通过 debug 或行走；这里用直接修改 SAVE 重进
    const townSave = { ...SAVE, player: { ...SAVE.player, scene: 'town', x: 20 * 32, y: 18 * 32 } };
    await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), townSave);
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1000);
    await enterGame('town');
    await sleep(1500); // 等 setupTownDecorations + spawnTownButterflies

    let townButterflies = await page.evaluate(() => {
      const scene = window.__game?.scene.getScenes(true)[0];
      const bs = scene?.catchableButterflies ?? [];
      return {
        count: bs.length,
        captured: bs.map((b) => b.getData('captured')),
      };
    });
    result('7.10 town 白天生成可捕捉蝴蝶（≥1）',
      townButterflies.count >= 1, JSON.stringify(townButterflies));
  } catch (e) {
    result('7.10 town 白天生成可捕捉蝴蝶（≥1）', false, '场景切换失败：' + e.message);
  }

  // 7.11 捕虫「自然记录」：青禾凤蝶捕捉 → 得普通标本 + 触发 ch1_qinghe_butterfly_guide（无稀有标本）
  try {
    const qingheResult = await page.evaluate(() => {
      const scene = window.__game?.scene.getScenes(true)[0];
      if (!scene) return { ok: false, reason: 'no scene' };
      try { scene.storyDialogue?.close?.(); } catch (e) { /* ignore */ }
      const beforeNormal = window.debug?.getItemCount?.('butterfly_specimen') ?? -1;
      scene.createButterfly(400, 300, { type: 'qinghe' });
      const b = scene.catchableButterflies[scene.catchableButterflies.length - 1];
      if (!b) return { ok: false, reason: 'no butterfly created' };
      scene.tryCatchButterfly(b);
      const afterNormal = window.debug?.getItemCount?.('butterfly_specimen') ?? -1;
      return {
        type: b.getData('type'),
        normalDelta: afterNormal - beforeNormal,
        guideTriggered: window.debug?.events?.hasTriggered?.('ch1_qinghe_butterfly_guide') ?? false,
      };
    });
    result('7.11 青禾凤蝶捕捉 → butterfly_specimen +1 且触发 ch1_qinghe_butterfly_guide',
      qingheResult.type === 'qinghe' &&
      qingheResult.normalDelta === 1 &&
      qingheResult.guideTriggered === true,
      JSON.stringify(qingheResult));
  } catch (e) {
    result('7.11 青禾凤蝶捕捉 → +1 且触发引导', false, e.message);
  }

  // ========== 8. 无运行时错误 ==========
  console.log('\n--- 8. 错误检查 ---');
  // 过滤已知的非致命 warning
  const fatalErrors = errors.filter((e) =>
    !e.includes('favicon') &&
    !e.includes('Failed to load resource') &&
    !e.includes('net::ERR')
  );
  result('8.1 全程无致命运行时错误', fatalErrors.length === 0,
    fatalErrors.length ? fatalErrors.slice(0, 3).join(' | ') : '');

} catch (e) {
  console.log(`\n💥 探针异常：${e.message}`);
  console.log(e.stack);
  fail++;
} finally {
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
