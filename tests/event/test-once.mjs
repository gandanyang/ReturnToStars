/**
 * Event Test: 一次性事件系统
 *
 * 验证：
 *   1. triggerOnce 首次调用执行回调并返回 true
 *   2. 同 ID 再次调用不执行、返回 false
 *   3. markTriggered 可标记已触发
 *   4. hasTriggered 正确读取状态
 *   5. 事件状态随存档持久化（刷新后保持）
 *
 * 前置：dev server 在 localhost:5173 运行
 */

import { launch, close, sleep, waitForGame } from '../harness/browser.mjs';
import { clearSave, readSave, gotoScene } from '../harness/game.mjs';

export default async function ({ suiteReport: r }) {
  const { browser, page } = await launch({ viewport: { width: 1024, height: 768 } });

  try {
    // 1. 清档启动
    await clearSave(page);

    // 2. 测试 triggerOnce 首次执行
    const firstResult = await page.evaluate(() => {
      let executed = false;
      const fired = window.debug.events.triggerOnce('test_event_a', () => { executed = true; });
      return { fired, executed, hasTriggered: window.debug.events.hasTriggered('test_event_a') };
    });
    r.check('triggerOnce 首次执行回调', firstResult.fired === true && firstResult.executed === true);
    r.check('hasTriggered 返回 true', firstResult.hasTriggered === true);

    // 3. 同 ID 再次调用不执行
    const secondResult = await page.evaluate(() => {
      let executed = false;
      const fired = window.debug.events.triggerOnce('test_event_a', () => { executed = true; });
      return { fired, executed };
    });
    r.check('重复调用不执行', secondResult.fired === false && secondResult.executed === false);

    // 4. markTriggered 标记另一个事件
    const markResult = await page.evaluate(() => {
      window.debug.events.markTriggered('test_event_b');
      return window.debug.events.hasTriggered('test_event_b');
    });
    r.check('markTriggered 标记成功', markResult === true);

    // 5. 未触发的事件 hasTriggered 返回 false
    const notTriggered = await page.evaluate(() => window.debug.events.hasTriggered('test_event_never'));
    r.check('未触发事件返回 false', notTriggered === false);

    // 6. 进入农场场景（nextDay 需要场景有 player 才会存档）
    await page.evaluate(() => window.debug.setStoryStep('done'));
    await gotoScene(page, 'farm', { x: 480, y: 300 });

    // 7. 触发 nextDay 存档（场景有 player → save 执行 → 事件状态写入存档）
    await page.evaluate(() => window.debug.nextDay());
    await sleep(500);

    // 8. 验证事件状态在存档中
    const saveBefore = await readSave(page);
    r.check('存档已写入', saveBefore !== null, saveBefore ? `day=${saveBefore.day}` : 'null');

    const eventSaveBefore = await page.evaluate(() => window.debug.events.getSaveData());
    r.check('事件状态包含 test_event_a', eventSaveBefore.triggeredEvents?.['test_event_a'] === true,
      `keys=${Object.keys(eventSaveBefore.triggeredEvents ?? {}).length}`);

    // 9. 刷新页面验证持久化
    //    reload 后游戏只启动 TitleScene，StationScene.create 才会调用 apply() 恢复事件状态。
    //    这里按 Enter 触发 TitleScene → station → apply → farm 真实链路。
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForGame(page);
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(3000); // 等待 TitleScene fadeOut + StationScene.create(apply) + farm 启动

    const afterReload = await page.evaluate(() => ({
      a: window.debug.events.hasTriggered('test_event_a'),
      b: window.debug.events.hasTriggered('test_event_b'),
      never: window.debug.events.hasTriggered('test_event_never'),
    }));
    r.check('刷新后 test_event_a 仍已触发', afterReload.a === true);
    r.check('刷新后 test_event_b 仍已触发', afterReload.b === true);
    r.check('刷新后 test_event_never 仍未触发', afterReload.never === false);

    const passed = r.results.filter(x => x.ok).length;
    const failed = r.results.filter(x => !x.ok).length;
    return { passed, failed };
  } finally {
    await close(browser);
  }
}
