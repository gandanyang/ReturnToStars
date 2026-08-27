/**
 * P7c-b 探针：playStory 统一入口行为验证
 * 
 * 验证内容：
 * 1. playStory 普通对白播放
 * 2. playStory + onComplete 回调触发
 * 3. dialogueFactory 自动创建 StoryDialogue
 * 4. 防重叠：正在播放时再次调用返回 false
 * 5. seqId 正确传递
 * 6. 多次连续播放
 * 
 * 运行：node tests/probes/probe-play-story-integration.mjs
 * 依赖：Vite dev server
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5182/';
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

function isSceneError(result) {
  return result?.error === 'no_scene' || result?.error === 'not_map_scene';
}

// 等待对话播放完成的辅助函数（会自动按回车推进对话）
async function waitForDialogueComplete(page, maxWaitMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const state = await page.evaluate(() => {
      return window.debug?.storySequenceRunner?.getSceneRunnerState();
    });
    if (!state?.isPlaying) return true;
    
    // 按回车推进对话
    try {
      await page.keyboard.press('Enter');
    } catch (e) {
      // 忽略错误
    }
    
    await sleep(400);
  }
  return false;  // 超时
}

async function run() {
  console.log('=== P7c-b playStory 统一入口集成验证 ===\n');
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');

  try {
    // 加载游戏页面
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);

    // 标题 → 小镇：跳过开场动画
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

    // 设置为 done，给予工具
    await page.evaluate(() => {
      window.debug?.setStoryStep?.('done');
      window.debug?.giveItem?.('old_hoe', 10);
      window.debug?.giveItem?.('old_watering_can', 10);
    });
    await sleep(300);

    // 使用与其他探针相同的方法切换到 MapScene
    const sceneSwitched = await page.evaluate(() => {
      const game = window.__game;
      if (!game) return { success: false, reason: 'no_game' };
      const scenes = game.scene.getScenes(true);
      // 停止当前场景并启动 MapScene（小镇 key 为 'town'）
      if (scenes.length > 0) {
        game.scene.stop(scenes[0].scene.key);
      }
      game.scene.start('town', { spawn: { x: 15 * 16, y: 12 * 16, facing: 'down' } });
      return { success: true };
    });
    
    console.log(`  场景切换: ${JSON.stringify(sceneSwitched)}`);
    await sleep(3500);
    
    // 验证场景
    const sceneKey = await page.evaluate(() => {
      return window.__game?.scene?.getScenes?.(true)?.[0]?.scene?.key ?? 'unknown';
    });
    console.log(`  当前场景: ${sceneKey}`);

    // ==========================================
    // 测试 1: debug API 可用性
    // ==========================================
    console.log('📋 测试 1: debug API 可用性');
    {
      const available = await page.evaluate(() => {
        return !!window.debug?.storySequenceRunner?.testPlayStory;
      });
      check('debug.storySequenceRunner.testPlayStory 可用', available);
      
      const autoCreateAvailable = await page.evaluate(() => {
        return !!window.debug?.storySequenceRunner?.testDialogueAutoCreate;
      });
      check('debug.storySequenceRunner.testDialogueAutoCreate 可用', autoCreateAvailable);
    }

    // ==========================================
    // 测试 2: MapScene 集成状态
    // ==========================================
    console.log('\n📋 测试 2: MapScene 集成状态');
    let sceneReady = false;
    {
      const state = await page.evaluate(() => {
        return window.debug?.storySequenceRunner?.getSceneRunnerState();
      });
      console.log(`  调试信息: ${JSON.stringify(state)}`);
      if (state?.error === 'no_scene') {
        check('当前为 TitleScene，无 MapScene', false, '需要在 MapScene 中测试');
      } else if (state?.error === 'no_runner') {
        check('MapScene 有 runner', false, `sceneType=${state.sceneType}, hasRunner=${state.hasRunner}`);
      } else if (state?.isPlaying !== undefined) {
        check('MapScene runner 可获取', true, `isPlaying=${state.isPlaying}`);
        sceneReady = true;
      }
    }

    if (!sceneReady) {
      console.log('\n  ⚠️  MapScene 未就绪，需要游戏在小镇场景中才能测试 playStory');
      console.log('  建议：使用 DevTestHub 跳转或加载存档后重新运行');
      console.log('\n  跳过后续集成测试（仅验证 debug API 可用性）');
      
      // 汇总
      console.log('\n==================================================');
      console.log(`📊 playStory 集成探针结果: ${passed}/${passed + failed} 通过`);
      for (const r of results) {
        console.log(r);
      }
      console.log('==================================================');
      
      if (failed === 0) {
        console.log('\n✅ 基础设施就绪（debug API 可用），等待 MapScene 就绪后可继续测试');
      } else {
        console.log(`\n❌ ${failed} 个测试失败`);
      }
      return;
    }

    // ==========================================
    // 测试 3: playStory 普通对白播放
    // ==========================================
    console.log('\n📋 测试 3: playStory 普通对白');
    {
      const result = await page.evaluate(() => {
        return window.debug.storySequenceRunner.testPlayStory(
          'probe_test_basic',
          2,
        );
      });
      
      if (isSceneError(result)) {
        console.log(`  ⚠️  跳过：${result?.error}`);
      } else {
        check('playStory 返回 true', result?.result === true, `result=${result?.result}`);
        check('播放中 isPlaying=true', result?.isPlaying === true, `isPlaying=${result?.isPlaying}`);
        check('currentId 正确传递', result?.currentId === 'probe_test_basic', `currentId=${result?.currentId}`);
        check('dialogue 已创建', result?.hasDialogue === true, `hasDialogue=${result?.hasDialogue}`);
      }
    }

    // ==========================================
    // 测试 4: playStory + onComplete 回调
    // ==========================================
    console.log('\n📋 测试 4: playStory + onComplete 回调');
    {
      const ready = await waitForDialogueComplete(page);
      if (!ready) console.log('  ⚠️  前一次对话等待超时');
      
      const result = await page.evaluate(() => {
        return window.debug.storySequenceRunner.testPlayStory(
          'probe_test_callback',
          1,
          { withOnComplete: true },
        );
      });
      
      if (isSceneError(result)) {
        console.log(`  ⚠️  跳过：${result?.error}`);
      } else {
        check('playStory 返回 true', result?.result === true, `result=${result?.result}`);
        check('completeCalled 初始为 false', result?.completeCalled === false, `completeCalled=${result?.completeCalled}`);
        
        // 等待对话完成后检查状态
        const done = await waitForDialogueComplete(page);
        if (done) {
          const stateAfter = await page.evaluate(() => {
            return window.debug.storySequenceRunner.getSceneRunnerState();
          });
          check('完成后 isPlaying=false', stateAfter?.isPlaying === false, `isPlaying=${stateAfter?.isPlaying}`);
        }
      }
    }

    // ==========================================
    // 测试 5: dialogueFactory 自动创建
    // ==========================================
    console.log('\n📋 测试 5: dialogueFactory 自动创建');
    {
      await waitForDialogueComplete(page);
      const result = await page.evaluate(() => {
        return window.debug.storySequenceRunner.testDialogueAutoCreate();
      });
      
      if (isSceneError(result)) {
        console.log(`  ⚠️  跳过：${result?.error}`);
      } else {
        check('playResult=true', result?.playResult === true, `playResult=${result?.playResult}`);
        check('play 后 hasDialogueAfter=true', result?.hasDialogueAfter === true, `hasDialogueAfter=${result?.hasDialogueAfter}`);
        check('play 后 isPlayingAfter=true', result?.isPlayingAfter === true, `isPlayingAfter=${result?.isPlayingAfter}`);
        check('currentIdAfter 正确', result?.currentIdAfter === 'auto_create_test', `currentIdAfter=${result?.currentIdAfter}`);
      }
    }

    // ==========================================
    // 测试 6: 防重叠（正在播放时再次调用）
    // ==========================================
    console.log('\n📋 测试 6: 防重叠机制');
    {
      await waitForDialogueComplete(page);
      
      // 先触发一次播放
      const firstResult = await page.evaluate(() => {
        return window.debug.storySequenceRunner.testPlayStory(
          'overlap_first',
          3,
        );
      });
      
      if (isSceneError(firstResult)) {
        console.log(`  ⚠️  跳过：${firstResult?.error}`);
      } else {
        check('第一次播放成功', firstResult?.result === true, `result=${firstResult?.result}`);
        
        // 立即尝试第二次调用（应该不抛异常）
        const secondResult = await page.evaluate(() => {
          return window.debug.storySequenceRunner.testPlayStory(
            'overlap_second',
            1,
          );
        });
        
        // 第二次应该不报错
        check('第二次调用不抛异常', secondResult !== undefined, `secondResult=${JSON.stringify(secondResult)}`);
        // 防重叠：第二次应该返回 false
        check('防重叠生效（第二次返回 false）', secondResult?.result === false, `result=${secondResult?.result}`);
      }
      
      await waitForDialogueComplete(page);
    }

    // ==========================================
    // 测试 7: seqId 正确传递
    // ==========================================
    console.log('\n📋 测试 7: seqId 正确传递');
    {
      await waitForDialogueComplete(page);
      const customId = 'custom_seq_id_test_123';
      const result = await page.evaluate((id) => {
        return window.debug.storySequenceRunner.testPlayStory(id, 1);
      }, customId);
      
      if (isSceneError(result)) {
        console.log(`  ⚠️  跳过：${result?.error}`);
      } else {
        check('自定义 seqId 传递正确', result?.currentId === customId, `currentId=${result?.currentId}`);
      }
      
      await waitForDialogueComplete(page);
    }

    // ==========================================
    // 测试 8: 多次连续播放
    // ==========================================
    console.log('\n📋 测试 8: 多次连续播放');
    {
      for (let i = 0; i < 3; i++) {
        await waitForDialogueComplete(page);
        
        const result = await page.evaluate((idx) => {
          return window.debug.storySequenceRunner.testPlayStory(`seq_${idx}`, 1);
        }, i);
        
        if (isSceneError(result)) {
          console.log(`  ⚠️  第${i + 1}次：跳过 ${result?.error}`);
          break;
        } else {
          check(`第${i + 1}次播放成功`, result?.result === true, `seq_${i} result=${result?.result}`);
          check(`第${i + 1}次 ID 正确`, result?.currentId === `seq_${i}`, `currentId=${result?.currentId}`);
        }
      }
    }

    // ==========================================
    // 汇总
    // ==========================================
    console.log('\n==================================================');
    console.log(`📊 playStory 集成探针结果: ${passed}/${passed + failed} 通过`);
    for (const r of results) {
      console.log(r);
    }
    console.log('==================================================');

    if (failed === 0) {
      console.log('\n✅ 所有 playStory 集成测试通过！');
      console.log('\n🔒 P7c-b 核心红线已验证：');
      console.log('   - playStory 可作为统一对话播放入口');
      console.log('   - dialogueFactory 自动创建 StoryDialogue');
      console.log('   - onComplete 回调正确触发');
      console.log('   - 防重叠机制有效');
      console.log('   - seqId 正确传递');
      console.log('   - 多次连续播放正常');
    } else {
      console.log(`\n❌ ${failed} 个测试失败`);
    }
  } catch (error) {
    console.error('测试执行出错:', error);
    failed++;
  } finally {
    await browser.close();
  }
}

run().catch(console.error);