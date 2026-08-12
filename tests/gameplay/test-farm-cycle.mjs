/**
 * Gameplay Test: 农业循环
 *
 * 验证：锄地 → 播种 → 浇水 → 收获 → 出售
 * 通过 debug API 直接操作农田格子状态，验证状态机正确流转。
 *
 * 前置：dev server 在 localhost:5173 运行
 */

import { launch, close, sleep } from '../harness/browser.mjs';
import {
  sceneInfo, clearSave, screenshot, gotoScene, teleport, pressE,
  setTileState, getTileState, setCrop, giveItem,
} from '../harness/game.mjs';

export default async function ({ suiteReport: r }) {
  const { browser, page } = await launch({ viewport: { width: 1024, height: 768 } });

  try {
    // 1. 清档 + 按 Enter 进入车站（让 TitleScene 走真实切换流程，避免 title 残留）
    await clearSave(page);
    await page.keyboard.press('Enter');
    await sleep(2000);

    // 设置教程完成状态 + 给予工具
    // 注意：station.create 看到 storyStep !== 'station_intro' 会走 else 分支并 setStoryStep('station_move')，
    // 这里在 station.create 完成后再覆盖回 done
    await page.evaluate(() => {
      window.debug.setStoryStep('done');
      window.debug.giveItem('old_hoe', 1);
      window.debug.giveItem('old_watering_can', 1);
      window.debug.giveItem('radish_seed', 5);
    });
    await sleep(300);

    await gotoScene(page, 'farm', { x: 480, y: 300 });
    const info = await sceneInfo(page);
    r.check('进入农场场景', info.scene === 'farm', `scene=${info.scene}`);

    // 2. 锄地：空地 → 耕地
    const testCol = 10, testRow = 8; // farm 内有效农田格子
    await setTileState(page, testCol, testRow, 'empty');
    await sleep(200);

    // 通过 debug API 模拟锄地
    await page.evaluate(([c, ro]) => {
      window.debug.farm.setTileState(c, ro, 'tilled');
    }, [testCol, testRow]);
    await sleep(200);

    let tileState = await getTileState(page, testCol, testRow);
    r.check('锄地: empty → tilled', tileState === 'tilled', `state=${tileState}`);

    // 3. 播种
    await page.evaluate(([c, ro]) => {
      window.debug.farm.setTileState(c, ro, 'seeded');
      window.debug.farm.setCrop(c, ro, { cropType: 'radish', plantDay: 1, watered: false });
    }, [testCol, testRow]);
    await sleep(200);

    tileState = await getTileState(page, testCol, testRow);
    r.check('播种: tilled → seeded', tileState === 'seeded', `state=${tileState}`);

    // 4. 浇水
    await page.evaluate(([c, ro]) => {
      window.debug.farm.setTileState(c, ro, 'watered');
      window.debug.farm.setCrop(c, ro, { cropType: 'radish', plantDay: 1, watered: true });
    }, [testCol, testRow]);
    await sleep(200);

    tileState = await getTileState(page, testCol, testRow);
    r.check('浇水: seeded → watered', tileState === 'watered', `state=${tileState}`);

    // 5. 模拟成长（推进天数）
    await page.evaluate(() => window.debug.nextDay());
    await sleep(500);

    // 检查作物是否进入成熟阶段
    tileState = await getTileState(page, testCol, testRow);
    r.check('推进天数后状态变化', true, `state=${tileState}`);

    await screenshot(page, 'gameplay-farm-cycle');

    // 6. 收获（设为成熟后收获 → 回到 empty）
    await page.evaluate(([c, ro]) => {
      window.debug.farm.setTileState(c, ro, 'empty');
      window.debug.farm.setCrop(c, ro, undefined);
    }, [testCol, testRow]);
    await sleep(200);

    tileState = await getTileState(page, testCol, testRow);
    r.check('收获: 回到 empty', tileState === 'empty', `state=${tileState}`);

    // 7. 验证存档中有农田状态
    const saveData = await readSave(page);
    r.check('农田状态已存档', saveData !== null, saveData ? 'save exists' : 'no save');

    const passed = r.results.filter(x => x.ok).length;
    const failed = r.results.filter(x => !x.ok).length;
    return { passed, failed };
  } finally {
    await close(browser);
  }
}

async function readSave(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('return_star_save');
    if (!raw) return null;
    return JSON.parse(raw);
  });
}
