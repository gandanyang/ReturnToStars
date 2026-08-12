/**
 * Chapter Test: 第0章回归
 *
 * 验证：
 *   1. 新游戏从第0章开始
 *   2. 教程步骤可以正常推进（station_intro → done）
 *   3. questState 可设置为 completed
 *   4. markObservatoryComplete 后 isObservatoryComplete 返回 true
 *   5. 章节状态随存档持久化
 *
 * 前置：dev server 在 localhost:5173 运行
 */

import { launch, close, sleep, waitForGame } from '../harness/browser.mjs';
import { clearSave, readSave, sceneInfo, gotoScene } from '../harness/game.mjs';

export default async function ({ suiteReport: r }) {
  const { browser, page } = await launch({ viewport: { width: 1024, height: 768 } });

  try {
    // 1. 清档启动
    await clearSave(page);
    const fresh = await sceneInfo(page);
    r.check('新游戏从标题开始', fresh.scene === 'title', `scene=${fresh.scene}`);

    // 2. 验证初始章节 = 0
    const chapterBefore = await page.evaluate(() => window.debug.getChapter());
    r.check('初始章节 = 0', chapterBefore === 0, `chapter=${chapterBefore}`);

    // 3. 进入游戏
    await page.keyboard.press('Enter');
    await sleep(2000);
    const stationInfo = await sceneInfo(page);
    r.check('进入车站场景', stationInfo.scene === 'station', `scene=${stationInfo.scene}`);

    // 4. 验证初始 storyStep = station_intro
    const stepBefore = await page.evaluate(() => window.debug.getStoryStep());
    r.check('初始 storyStep = station_intro', stepBefore === 'station_intro', `step=${stepBefore}`);

    // 5. 推进教程步骤：station_intro → done
    const steps = ['station_move', 'arrive_manor', 'xiya_talk', 'get_key',
                   'gate_opened', 'clear_land', 'sow_seeds', 'water_crops',
                   'evening_talk', 'done'];

    let allAdvanced = true;
    for (const expectedStep of steps) {
      await page.evaluate(() => window.debug.advanceStory());
      const step = await page.evaluate(() => window.debug.getStoryStep());
      if (step !== expectedStep) {
        r.check(`推进到 ${expectedStep}`, false, `实际=${step}`);
        allAdvanced = false;
        break;
      }
    }
    r.check('教程全部步骤推进成功', allAdvanced);

    // 6. 验证教程完成
    const isDone = await page.evaluate(() => {
      return window.debug.getStoryStep() === 'done';
    });
    r.check('教程完成 (storyStep=done)', isDone);

    // 7. 设置 questState = completed
    await page.evaluate(() => window.debug.setQuestState('completed'));
    const questState = await page.evaluate(() => window.debug.getQuestState());
    r.check('questState 可设为 completed', questState === 'completed', `state=${questState}`);

    // 8. 标记观星完成
    await page.evaluate(() => {
      // markObservatoryComplete 是内部函数，通过 setStoryStep 调用
      // 实际游戏中由 startStargaze() 调用 markObservatoryComplete
      // debug API 没有直接暴露，但 setStoryStep 可以设到 observatory_complete
      window.debug.setStoryStep('observatory_complete');
    });
    const observatoryDone = await page.evaluate(() => window.debug.getObservatoryComplete());
    r.check('观星完成标记生效', observatoryDone === true);

    // 9. 进入农场场景（nextDay 需要场景有 player 才会存档）
    await gotoScene(page, 'farm', { x: 480, y: 300 });

    // 10. 触发存档
    await page.evaluate(() => window.debug.nextDay());
    await sleep(500);

    // 10. 验证存档中章节状态
    const saveBefore = await readSave(page);
    r.check('存档中有章节状态', saveBefore !== null);
    r.check('存档 storyStep = observatory_complete',
      saveBefore?.storyStep === 'observatory_complete',
      `step=${saveBefore?.storyStep}`);

    // 11. 刷新验证持久化
    //    reload 后游戏只启动 TitleScene，StationScene.create 才会调用 apply() 恢复 storyStep。
    //    按 Enter 触发 TitleScene → station → apply → farm 真实链路。
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForGame(page);
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(3000); // 等待 TitleScene fadeOut + StationScene.create(apply) + farm 启动

    const stepAfter = await page.evaluate(() => window.debug.getStoryStep());
    r.check('刷新后 storyStep 保持', stepAfter === 'observatory_complete',
      `step=${stepAfter}`);

    const passed = r.results.filter(x => x.ok).length;
    const failed = r.results.filter(x => !x.ok).length;
    return { passed, failed };
  } finally {
    await close(browser);
  }
}
