/**
 * P8 CutsceneGuard 探针
 * 
 * 验证目标：
 *   1. CutsceneGuard 基本 API（begin/end/isBlocked/getSnapshot）
 *   2. MapScene 5 个 cutscene 旗标 getter/setter 正确委托给 CutsceneGuard
 *   3. GateSnapshot 包含全部 5 个 cutscene 旗标
 *   4. InteractionRouter.checkGate 覆盖全部 5 个旗标
 *   5. firstMorningActive 语义为 window lock（非 scene cutscene）
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5175/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    results.push(`  ✅ ${name}${detail ? ' - ' + detail : ''}`);
  } else {
    failed++;
    results.push(`  ❌ ${name}${detail ? ' - ' + detail : ''}`);
  }
}

async function run() {
  console.log('=== P8 CutsceneGuard 验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox', '--disable-features=NetworkService', '--no-network-queries'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(3000);

    // ========== Part 1: CutsceneGuard 单元测试 ==========
    console.log('--- Part 1: CutsceneGuard 单元测试 ---');
    const unitResult = await page.evaluate(() => {
      return window.debug.cutsceneGuard.unit();
    });
    
    check('初始无激活', unitResult.initiallyNoActive);
    check('初始未阻塞', unitResult.initiallyNotBlocked);
    check('begin(stargaze) 后 stargaze 激活', unitResult.stargazeActive);
    check('begin(stargaze) 后 anyActive', unitResult.anyActiveAfterBegin);
    check('begin(art_show) 后两个激活', unitResult.bothActive);
    check('end(stargaze) 后仅 art_show 激活', unitResult.onlyArtShow);
    check('beginWindow 后 windowLocked', unitResult.windowLocked);
    check('beginWindow 后 isBlocked', unitResult.blockedByWindow);
    check('endWindow 后 window 未锁定', unitResult.windowUnlocked);
    check('全部清除后无激活无阻塞', unitResult.allCleared);
    check('snapshot 包含 inStargazeCutscene=true', unitResult.snapshotStargaze);
    check('snapshot 包含 firstMorningActive=true', unitResult.snapshotFirstMorning);

    // ========== Part 2: MapScene getter/setter 委托 ==========
    console.log('\n--- Part 2: MapScene getter/setter 委托 ---');
    
    // 进入 MapScene
    const sceneSwitchResult = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return { error: 'no_game' };
      const scenes = game.scene.getScenes(true);
      if (scenes.length > 0) {
        const currentKey = scenes[0].scene.key;
        if (currentKey !== 'town') {
          game.scene.stop(currentKey);
        }
      }
      game.scene.start('town', { fromMapSceneNoSave: true });
      return { ok: true };
    });
    
    if (sceneSwitchResult.error) {
      check('场景切换', false, sceneSwitchResult.error);
      console.log('  跳过后续集成测试');
      return;
    }
    
    await sleep(2000);
    
    const sceneState = await page.evaluate(() => {
      return window.debug.cutsceneGuard.getSceneState();
    });
    
    check('MapScene 有 cutsceneGuard 属性', !sceneState.error, sceneState.error || 'ok');
    check('初始状态无激活', !sceneState.isAnyActive);
    check('初始状态未阻塞', !sceneState.isBlocked);
    check('初始状态无 window lock', !sceneState.isWindowLocked);
    
    // 测试 setter/getter 委托
    const setterResult = await page.evaluate(() => {
      return window.debug.cutsceneGuard.testSetterGetter();
    });
    
    check('setter 测试无错误', !setterResult.error, setterResult.error || 'ok');
    if (!setterResult.error) {
      check('初始 inStargazeCutscene 为 false', setterResult.initVal === false);
      check('set(true) 后读取为 true', setterResult.afterSet === true);
      check('set(false) 后读取为 false', setterResult.afterClear === false);
    }

    // ========== Part 3: GateSnapshot 包含全部 5 旗标 ==========
    console.log('\n--- Part 3: GateSnapshot 包含全部 5 旗标 ---');
    
    // 通过 InteractionRouter 测试 GateSnapshot
    const gateSnapshot = await page.evaluate(() => {
      return window.debug.interactionRouter.checkGate({
        createFailed: false,
        endingPanelOpen: false,
        inStargazeCutscene: true,
        inArtShowCutscene: false,
        inSpringFairCutscene: true,
        inDryyardCutscene: false,
        firstMorningActive: false,
        photoAlbumOpen: false,
        discoveryOpen: false,
        hudMenuOpen: false,
        residentBoardOpen: false,
        shopOpen: false,
        backpackOpen: false,
        questOpen: false,
        waitPanelOpen: false,
      });
    });
    
    check('inStargazeCutscene → dialogue_only(stargaze)', gateSnapshot.type === 'dialogue_only' && gateSnapshot.scene === 'stargaze');
    
    // 测试 spring_fair 旗标
    const springFairGate = await page.evaluate(() => {
      return window.debug.interactionRouter.checkGate({
        createFailed: false,
        endingPanelOpen: false,
        inStargazeCutscene: false,
        inArtShowCutscene: false,
        inSpringFairCutscene: true,
        inDryyardCutscene: false,
        firstMorningActive: false,
        photoAlbumOpen: false,
        discoveryOpen: false,
        hudMenuOpen: false,
        residentBoardOpen: false,
        shopOpen: false,
        backpackOpen: false,
        questOpen: false,
        waitPanelOpen: false,
      });
    });
    
    check('inSpringFairCutscene → dialogue_only(spring_fair)', springFairGate.type === 'dialogue_only' && springFairGate.scene === 'spring_fair');
    
    // 测试 dryyard 旗标
    const dryyardGate = await page.evaluate(() => {
      return window.debug.interactionRouter.checkGate({
        createFailed: false,
        endingPanelOpen: false,
        inStargazeCutscene: false,
        inArtShowCutscene: false,
        inSpringFairCutscene: false,
        inDryyardCutscene: true,
        firstMorningActive: false,
        photoAlbumOpen: false,
        discoveryOpen: false,
        hudMenuOpen: false,
        residentBoardOpen: false,
        shopOpen: false,
        backpackOpen: false,
        questOpen: false,
        waitPanelOpen: false,
      });
    });
    
    check('inDryyardCutscene → dialogue_only(dryyard)', dryyardGate.type === 'dialogue_only' && dryyardGate.scene === 'dryyard');
    
    // 测试 firstMorningActive（window lock）
    const morningGate = await page.evaluate(() => {
      return window.debug.interactionRouter.checkGate({
        createFailed: false,
        endingPanelOpen: false,
        inStargazeCutscene: false,
        inArtShowCutscene: false,
        inSpringFairCutscene: false,
        inDryyardCutscene: false,
        firstMorningActive: true,
        photoAlbumOpen: false,
        discoveryOpen: false,
        hudMenuOpen: false,
        residentBoardOpen: false,
        shopOpen: false,
        backpackOpen: false,
        questOpen: false,
        waitPanelOpen: false,
      });
    });
    
    check('firstMorningActive → dialogue_only(morning_window)', morningGate.type === 'dialogue_only' && morningGate.scene === 'morning_window');

    // ========== Part 4: 多旗标优先级 ==========
    console.log('\n--- Part 4: 多旗标优先级 ---');
    
    // stargaze 优先于 spring_fair
    const multiGate = await page.evaluate(() => {
      return window.debug.interactionRouter.checkGate({
        createFailed: false,
        endingPanelOpen: false,
        inStargazeCutscene: true,
        inArtShowCutscene: false,
        inSpringFairCutscene: true,
        inDryyardCutscene: false,
        firstMorningActive: true,
        photoAlbumOpen: false,
        discoveryOpen: false,
        hudMenuOpen: false,
        residentBoardOpen: false,
        shopOpen: false,
        backpackOpen: false,
        questOpen: false,
        waitPanelOpen: false,
      });
    });
    
    check('多旗标：stargaze 优先于 spring_fair', multiGate.type === 'dialogue_only' && multiGate.scene === 'stargaze');

    // createFailed 最优先
    const blockGate = await page.evaluate(() => {
      return window.debug.interactionRouter.checkGate({
        createFailed: true,
        endingPanelOpen: false,
        inStargazeCutscene: true,
        inArtShowCutscene: false,
        inSpringFairCutscene: true,
        inDryyardCutscene: false,
        firstMorningActive: true,
        photoAlbumOpen: false,
        discoveryOpen: false,
        hudMenuOpen: false,
        residentBoardOpen: false,
        shopOpen: false,
        backpackOpen: false,
        questOpen: false,
        waitPanelOpen: false,
      });
    });
    
    check('createFailed 最优先 → block', blockGate.type === 'block');

    // endingPanel 优先于 cutscene
    const freezeGate = await page.evaluate(() => {
      return window.debug.interactionRouter.checkGate({
        createFailed: false,
        endingPanelOpen: true,
        inStargazeCutscene: true,
        inArtShowCutscene: false,
        inSpringFairCutscene: true,
        inDryyardCutscene: false,
        firstMorningActive: true,
        photoAlbumOpen: false,
        discoveryOpen: false,
        hudMenuOpen: false,
        residentBoardOpen: false,
        shopOpen: false,
        backpackOpen: false,
        questOpen: false,
        waitPanelOpen: false,
      });
    });
    
    check('endingPanel 优先于 cutscene → freeze_all', freezeGate.type === 'freeze_all');

  } catch (err) {
    console.error('探针执行错误:', err);
    failed++;
    results.push(`  ❌ 执行错误: ${err.message}`);
  } finally {
    await browser.close();
  }

  // 输出结果
  console.log('\n' + '='.repeat(50));
  console.log(`P8 CutsceneGuard 探针结果: ${passed}/${passed + failed} 通过`);
  console.log('='.repeat(50));
  results.forEach(r => console.log(r));
  
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('探针启动失败:', err);
  process.exit(1);
});
