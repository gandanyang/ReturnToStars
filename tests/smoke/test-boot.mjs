/**
 * Smoke Test: 游戏启动验证
 *
 * 验证：
 *   1. 页面加载无异常
 *   2. Phaser 初始化成功
 *   3. 标题场景出现
 *   4. 新游戏可进入第一个场景
 *   5. 无 console error
 *
 * 前置：dev server 在 localhost:5173 运行
 */

import { launch, close, sleep } from '../harness/browser.mjs';
import { sceneInfo, clearSave, screenshot, pressE } from '../harness/game.mjs';

export default async function ({ suiteReport: r }) {
  const { browser, page } = await launch({ viewport: { width: 1024, height: 768 } });

  try {
    // 1. 清档确保干净状态
    await clearSave(page);

    // 2. 验证游戏加载
    const info = await sceneInfo(page);
    r.check('页面加载 + Phaser 初始化', info.scene !== 'none', `scene=${info.scene}`);
    r.check('标题场景出现', info.scene === 'title', `scene=${info.scene}`);

    await screenshot(page, 'smoke-boot-title');

    // 3. 按 Enter 进入新游戏（标题场景响应 Enter/Space/点击，不响应 E）
    await page.keyboard.press('Enter');
    await sleep(2000);

    const afterEnter = await sceneInfo(page);
    r.check('进入车站场景', afterEnter.scene === 'station', `scene=${afterEnter.scene}`);

    await screenshot(page, 'smoke-boot-station');

    // 4. 检查 console errors（过滤 Phaser 自身的 warning）
    const realErrors = page._consoleErrors.filter(e =>
      !e.includes('deprecated') &&
      !e.includes('[Phaser]') &&
      !e.includes('DevTools')
    );
    r.check('无致命 console error', realErrors.length === 0,
      realErrors.length > 0 ? realErrors[0].substring(0, 80) : 'clean');

    const passed = r.results.filter(x => x.ok).length;
    const failed = r.results.filter(x => !x.ok).length;
    return { passed, failed };
  } finally {
    await close(browser);
  }
}
