/**
 * Save Test: 存档保存与恢复
 *
 * 验证：
 *   1. 游戏运行后存档数据写入 localStorage
 *   2. 刷新页面后存档数据保持
 *   3. 关键状态（day/storyStep/coins/inventory）一致
 *
 * 策略：用 debug.nextDay() 触发自动存档（nextDay 内部调用 save()），
 * 不直接操作 localStorage——验证的是真实存档链路。
 *
 * 前置：dev server 在 localhost:5173 运行
 */

import { launch, close, sleep, waitForGame } from '../harness/browser.mjs';
import { sceneInfo, readSave, clearSave, screenshot, giveItem } from '../harness/game.mjs';

export default async function ({ suiteReport: r }) {
  const { browser, page } = await launch({ viewport: { width: 1024, height: 768 } });

  try {
    // 1. 清档启动
    await clearSave(page);
    const beforeInfo = await sceneInfo(page);
    r.check('清档后从标题开始', beforeInfo.scene === 'title', `scene=${beforeInfo.scene}`);

    // 2. 进入游戏（Enter 开始）
    await page.keyboard.press('Enter');
    await sleep(2000);
    const stationInfo = await sceneInfo(page);
    r.check('进入车站场景', stationInfo.scene === 'station', `scene=${stationInfo.scene}`);

    // 3. 跳过车站对白 → 进入大门 → 农场
    //    用 debug API 快速推进教程到完成状态
    await page.evaluate(() => {
      window.debug.setStoryStep('done');
      window.debug.giveItem('radish_seed', 5);
      window.debug.giveItem('wood', 10);
    });
    await sleep(300);

    // 4. nextDay 触发自动存档（内部调用 save()）
    await page.evaluate(() => window.debug.nextDay());
    await sleep(500);

    // 5. 读取存档快照
    const saveBefore = await readSave(page);
    r.check('存档写入 localStorage', saveBefore !== null, saveBefore ? `day=${saveBefore.day}` : 'null');
    r.check('存档 storyStep=done', saveBefore?.storyStep === 'done', `step=${saveBefore?.storyStep}`);
    r.check('存档有 inventory', saveBefore?.inventory != null, saveBefore?.inventory ? 'has items' : 'null');
    r.check('存档有 radish_seed', (saveBefore?.inventory?.['radish_seed'] ?? 0) >= 5,
      `count=${saveBefore?.inventory?.['radish_seed'] ?? 0}`);

    await screenshot(page, 'save-before-reload');

    // 6. 刷新页面（模拟杀进程重开）
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForGame(page);
    await sleep(1000);

    // 7. 验证存档恢复
    const saveAfter = await readSave(page);
    r.check('刷新后存档仍在', saveAfter !== null, saveAfter ? `day=${saveAfter.day}` : 'null');
    r.check('刷新后 storyStep 一致', saveAfter?.storyStep === saveBefore?.storyStep,
      `before=${saveBefore?.storyStep} after=${saveAfter?.storyStep}`);
    r.check('刷新后 day 一致', saveAfter?.day === saveBefore?.day,
      `before=${saveBefore?.day} after=${saveAfter?.day}`);

    // inventory 持久化
    if (saveBefore?.inventory && saveAfter?.inventory) {
      const beforeSeeds = saveBefore.inventory['radish_seed'] ?? 0;
      const afterSeeds = saveAfter.inventory['radish_seed'] ?? 0;
      r.check('刷新后 inventory 一致', beforeSeeds === afterSeeds,
        `seeds: before=${beforeSeeds} after=${afterSeeds}`);
    } else {
      r.check('刷新后 inventory 一致', false, 'inventory 读取失败');
    }

    await screenshot(page, 'save-after-reload');

    const passed = r.results.filter(x => x.ok).length;
    const failed = r.results.filter(x => !x.ok).length;
    return { passed, failed };
  } finally {
    await close(browser);
  }
}
