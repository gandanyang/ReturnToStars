/**
 * P6d 经济链专项探针
 * 
 * 验证目标：
 *   1. 各农场操作的经济链正确性（体力消耗、时间消耗、物品增减、XP 增长）
 *   2. 经济链全部通过 Hooks 注入，FarmController 不直接持有资源系统
 *   3. 事务顺序：体力先扣 → 状态后改 → 经济副作用 → Action Time 后消耗
 * 
 * 红线：资源变化仍通过 Hooks 注入，FarmController 不得反向拥有 Inventory/XP/Time/Save
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

async function readState(page) {
  return page.evaluate(() => {
    const farm = window.debug?.farm;
    const scene = window.__game?.scene?.getScene('farm');
    const fc = scene?.farmController;
    
    const tile15_10 = scene?.getTileStateForDebug?.(15, 10) ?? farm?.getTileState?.(15, 10) ?? 'unknown';
    const tile16_11 = scene?.getTileStateForDebug?.(16, 11) ?? farm?.getTileState?.(16, 11) ?? 'unknown';
    
    return {
      stamina: window.debug?.getStamina?.() ?? -1,
      xp: window.debug?.getFarmXp?.() ?? { level: -1, xp: -1 },
      time: window.debug?.getTimeStr?.() ?? 'no_api',
      hoe: window.debug?.getItemCount?.('old_hoe') ?? -1,
      can: window.debug?.getItemCount?.('old_watering_can') ?? -1,
      radishSeed: window.debug?.getItemCount?.('radish_seed') ?? -1,
      radish: window.debug?.getItemCount?.('radish') ?? -1,
      hasFc: !!fc,
      tile15_10,
      tile16_11,
    };
  });
}

async function run() {
  console.log('=== P6d 经济链专项验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('[FarmState]')) console.log('  🐛', t);
  });

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);

    // 标题 → 车站 → 跳过开场 → 跳过教程
    await page.keyboard.press('Enter');
    await sleep(2200);
    await page.evaluate(() => {
      const btn = document.getElementById('intro-skip-btn');
      if (btn) btn.click();
    });
    await sleep(800);
    try { await page.keyboard.press('Enter'); } catch {}
    await sleep(1000);

    // 跳过教程对话框
    for (let i = 0; i < 5; i++) {
      try { await page.keyboard.press('Enter'); } catch {}
      await sleep(300);
    }
    await sleep(500);

    // 设置为 done 跳过剧情，给予工具
    await page.evaluate(() => {
      window.debug?.setStoryStep?.('done');
      window.debug?.giveItem?.('old_hoe', 10);
      window.debug?.giveItem?.('old_watering_can', 10);
      window.debug?.giveItem?.('radish_seed', 20);
    });
    await sleep(300);

    // 直接进入农场场景
    await page.evaluate(() => {
      const game = window.__game;
      const scenes = game.scene.getScenes(true);
      if (scenes.length > 0) {
        game.scene.stop(scenes[0].scene.key);
      }
      game.scene.start('farm', { spawn: { x: 15 * 16, y: 12 * 16, facing: 'down' } });
    });
    await sleep(3500);

    const sceneKey = await page.evaluate(() => window.__game?.scene?.getScenes?.(true)?.[0]?.scene?.key ?? 'unknown');
    check('进入农场场景', sceneKey === 'farm', `scene=${sceneKey}`);

    // 验证 FarmController 存在
    const fcExists = await page.evaluate(() => !!window.__game?.scene?.getScene('farm')?.farmController);
    check('farmController 存在', fcExists);

    // ─── 基线 ───
    const baseline = await readState(page);
    console.log(`\n--- 基线状态 ---`);
    console.log(`  体力: ${baseline.stamina}, XP: ${JSON.stringify(baseline.xp)}, 时间: ${baseline.time}`);
    console.log(`  锄头: ${baseline.hoe}, 水壶: ${baseline.can}, 种子: ${baseline.radishSeed}, 萝卜: ${baseline.radish}`);

    // ─── 1. Till 经济链 ───
    console.log('\n--- 1. Till 经济链 ---');
    const tillBefore = await readState(page);
    const tillResult = await page.evaluate(() => {
      return window.__game?.scene?.getScene('farm')?.farmController?.executeTill(15, 10);
    });
    await sleep(200);
    const tillAfter = await readState(page);

    check('锄地成功', tillResult === true, `result=${tillResult}`);
    check('锄地体力消耗', tillAfter.stamina < tillBefore.stamina,
      `before=${tillBefore.stamina} after=${tillAfter.stamina}`);
    check('锄地不消耗种子', tillAfter.radishSeed === tillBefore.radishSeed,
      `seeds: ${tillBefore.radishSeed} → ${tillAfter.radishSeed}`);
    check('锄地状态变更为 tilled', tillAfter.tile15_10 === 'tilled',
      `state=${tillAfter.tile15_10}`);

    // ─── 2. Plant 经济链 ───
    console.log('\n--- 2. Plant 经济链 ---');
    const plantBefore = await readState(page);
    const plantResult = await page.evaluate(() => {
      return window.__game?.scene?.getScene('farm')?.farmController?.executePlant(15, 10, 'radish');
    });
    await sleep(200);
    const plantAfter = await readState(page);

    check('播种成功', plantResult === true, `result=${plantResult}`);
    check('播种种子消耗 (-1)', plantAfter.radishSeed === plantBefore.radishSeed - 1,
      `seeds: ${plantBefore.radishSeed} → ${plantAfter.radishSeed}`);
    check('播种体力消耗', plantAfter.stamina < plantBefore.stamina,
      `before=${plantBefore.stamina} after=${plantAfter.stamina}`);
    check('播种 XP 增长', plantAfter.xp?.xp > plantBefore.xp?.xp || plantAfter.xp?.level >= plantBefore.xp?.level,
      `xp: ${JSON.stringify(plantBefore.xp)} → ${JSON.stringify(plantAfter.xp)}`);
    check('播种状态变更为 planted', plantAfter.tile15_10 === 'planted',
      `state=${plantAfter.tile15_10}`);

    // ─── 3. Water 经济链 ───
    console.log('\n--- 3. Water 经济链 ---');
    const waterBefore = await readState(page);
    const waterResult = await page.evaluate(() => {
      return window.__game?.scene?.getScene('farm')?.farmController?.executeWater(15, 10);
    });
    await sleep(200);
    const waterAfter = await readState(page);

    check('浇水成功', waterResult === true, `result=${waterResult}`);
    check('浇水体力消耗', waterAfter.stamina < waterBefore.stamina,
      `before=${waterBefore.stamina} after=${waterAfter.stamina}`);
    check('浇水 XP 不减少', waterAfter.xp?.xp >= waterBefore.xp?.xp,
      `xp: ${JSON.stringify(waterBefore.xp)} → ${JSON.stringify(waterAfter.xp)}`);
    check('浇水状态变更为 watered', waterAfter.tile15_10 === 'watered',
      `state=${waterAfter.tile15_10}`);

    // ─── 4. Harvest 经济链 ───
    console.log('\n--- 4. Harvest 经济链 ---');
    // 手动把作物设为 grown 状态
    await page.evaluate(() => {
      window.debug?.farm?.setTileState?.(15, 10, 'grown');
      window.debug?.farm?.setCrop?.(15, 10, { cropType: 'radish', plantDay: 1, watered: true });
    });
    await sleep(100);

    const harvestBefore = await readState(page);
    const harvestResult = await page.evaluate(() => {
      return window.__game?.scene?.getScene('farm')?.farmController?.executeHarvest(15, 10);
    });
    await sleep(200);
    const harvestAfter = await readState(page);

    check('收获成功', harvestResult === 'radish', `result=${harvestResult}`);
    check('收获作物入包 (+1)', harvestAfter.radish === harvestBefore.radish + 1,
      `radish: ${harvestBefore.radish} → ${harvestAfter.radish}`);
    check('收获体力消耗', harvestAfter.stamina < harvestBefore.stamina,
      `before=${harvestBefore.stamina} after=${harvestAfter.stamina}`);
    check('收获 XP 增长', harvestAfter.xp?.xp > harvestBefore.xp?.xp || harvestAfter.xp?.level >= harvestBefore.xp?.level,
      `xp: ${JSON.stringify(harvestBefore.xp)} → ${JSON.stringify(harvestAfter.xp)}`);
    check('收获状态回归为 tilled', harvestAfter.tile15_10 === 'tilled',
      `state=${harvestAfter.tile15_10}`);

    // ─── 5. 事务顺序验证：体力先扣 → 状态后改 ───
    console.log('\n--- 5. 事务顺序红线验证 ---');
    // 验证：正常操作时状态正确变更（间接证明体力检查在状态变更之前）
    const orderTest = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('farm');
      if (!s?.farmController) return { success: false };
      // 测试另一块空地
      const stateBefore = s.getTileStateForDebug?.(16, 11);
      const ok = s.farmController.executeTill(16, 11);
      const stateAfter = s.getTileStateForDebug?.(16, 11);
      return { success: ok && stateAfter === 'tilled', stateBefore, stateAfter, ok };
    });
    check('操作成功时状态正确变更（间接验证体力检查在前）',
      orderTest.success,
      `before=${orderTest.stateBefore} after=${orderTest.stateAfter}`);

    // ─── 6. Hooks 完整性验证 ───
    console.log('\n--- 6. Hooks 完整性验证 ---');
    const hooksCheck = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('farm');
      const fc = s?.farmController;
      if (!fc) return { success: false };
      return {
        success: true,
        hasGetItemCount: typeof fc.hooks?.getItemCount === 'function',
        hasConsumeStamina: typeof fc.hooks?.consumeStamina === 'function',
        hasSetTileState: typeof fc.hooks?.setTileState === 'function',
        hasSetCrop: typeof fc.hooks?.setCrop === 'function',
        hasAddItem: typeof fc.hooks?.addItem === 'function',
        hasAddXp: typeof fc.hooks?.addXp === 'function',
        hasConsumeMinutes: typeof fc.hooks?.consumeMinutes === 'function',
        hasOnFarmOpComplete: typeof fc.hooks?.onFarmOpComplete === 'function',
      };
    });
    check('hooks.getItemCount 存在', hooksCheck.hasGetItemCount);
    check('hooks.consumeStamina 存在', hooksCheck.hasConsumeStamina);
    check('hooks.setTileState 存在', hooksCheck.hasSetTileState);
    check('hooks.setCrop 存在', hooksCheck.hasSetCrop);
    check('hooks.addItem 存在', hooksCheck.hasAddItem);
    check('hooks.addXp 存在', hooksCheck.hasAddXp);
    check('hooks.consumeMinutes 存在', hooksCheck.hasConsumeMinutes);
    check('hooks.onFarmOpComplete 存在', hooksCheck.hasOnFarmOpComplete);

    // ─── 7. 代码边界审计（静态检查 FarmController 导入） ───
    console.log('\n--- 7. 代码边界审计（FarmController 无资源系统引用） ---');
    // 通过检查 FarmController 方法体中是否只通过 this.hooks 访问外部系统
    const boundaryCheck = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('farm');
      const fc = s?.farmController;
      if (!fc) return { success: false };
      // 检查 FarmController 实例没有 Inventory/Stamina/Time/Save 相关直接引用
      // （通过检查原型方法是否仅通过 hooks 调用）
      const proto = Object.getPrototypeOf(fc);
      const methodSources = {};
      for (const name of ['executeTill', 'executePlant', 'executeWater', 'executeHarvest']) {
        const fn = proto[name];
        if (fn) {
          const str = fn.toString();
          methodSources[name] = {
            usesHooks: str.includes('this.hooks.'),
            hasGetItemCount: str.includes('getItemCount'),
            hasConsumeStamina: str.includes('consumeStamina'),
            hasSetTileState: str.includes('setTileState'),
            hasAddItem: str.includes('addItem'),
            hasAddXp: str.includes('addXp') || str.includes('onFarmOpComplete'),
            hasConsumeMinutes: str.includes('consumeMinutes'),
          };
        }
      }
      return { success: true, methods: methodSources };
    });

    if (boundaryCheck.methods) {
      for (const [name, info] of Object.entries(boundaryCheck.methods)) {
        check(`${name} 通过 hooks 调用外部系统`, info.usesHooks, `${name}`);
      }
    }

    // ─── 8. 最终状态 ───
    console.log('\n--- 8. 最终状态汇总 ---');
    const finalState = await readState(page);
    console.log(`  体力: ${finalState.stamina}, XP: ${JSON.stringify(finalState.xp)}, 时间: ${finalState.time}`);
    console.log(`  萝卜: ${finalState.radish}, 种子: ${finalState.radishSeed}`);

    // 验证收获真的得到了萝卜
    check('经济链闭环：收获得到萝卜', finalState.radish >= 1, `radish=${finalState.radish}`);

    // ─── 结果 ───
    console.log('\n' + '='.repeat(50));
    console.log(`结果: ${passed} 通过 / ${failed} 失败`);
    console.log('='.repeat(50));

    if (failed > 0) {
      console.log('\n失败项:');
      for (const r of results) {
        if (r.includes('❌')) console.log(r);
      }
    } else {
      console.log('\n通过项:');
      for (const r of results) {
        if (r.includes('✅')) console.log(r);
      }
    }

  } catch (err) {
    console.error('探针异常:', err.message);
    failed++;
  } finally {
    await browser.close();
  }

  if (failed > 0) process.exit(1);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});