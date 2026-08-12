/**
 * 游戏操作 — 封装常用 debug API 操作，测试复用。
 * 所有方法均通过 page.evaluate 调用游戏内 debug API。
 */
import { sleep } from './browser.mjs';

/** 获取当前场景信息 */
export async function sceneInfo(page) {
  return page.evaluate(() => ({
    scene: window.__game.scene.getScenes(true)[0]?.scene?.key ?? 'none',
    step: window.debug?.getStoryStep?.() ?? null,
    chapter: window.debug?.getChapter?.() ?? 0,
    dialogueOpen: (() => {
      const s = window.__game.scene.getScenes(true)[0];
      return s?.storyDialogue?.isOpen?.() ?? false;
    })(),
  }));
}

/** 读取存档数据 */
export async function readSave(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('return_star_save');
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      day: d.world?.day,
      hour: d.world?.hour,
      minute: d.world?.minute,
      storyStep: d.story?.storyStep,
      scene: d.player?.scene,
      coins: d.world?.coins,
      inventory: d.player?.inventory ?? null,
      quests: d.world?.dailyQuest?.quests ?? null,
    };
  });
}

/** 清除存档并刷新 */
export async function clearSave(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  const { waitForGame } = await import('./browser.mjs');
  await waitForGame(page);
}

/** 跳过对话：每行 2 次 advance + 1 次关闭 */
export async function skipDialogue(page, lineCount) {
  const calls = lineCount * 2 + 1;
  for (let i = 0; i < calls; i++) {
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      if (s?.storyDialogue?.isOpen()) s.storyDialogue.advance();
    });
    await sleep(60);
  }
  await sleep(400);
}

/** 按下 E 键并等待 */
export async function pressE(page, waitMs = 300) {
  await page.keyboard.press('KeyE');
  await sleep(waitMs);
}

/** 传送玩家到指定位置 */
export async function teleport(page, sceneKey, x, y, facing = 'up') {
  await page.evaluate(([k, px, py, f]) => {
    const s = window.__game.scene.getScene(k);
    if (s?.player) { s.player.x = px; s.player.y = py; s.player.facing = f; }
  }, [sceneKey, x, y, facing]);
  await sleep(150);
}

/** 切换场景 */
export async function gotoScene(page, key, spawn) {
  await page.evaluate(([k, sp]) => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== k) g.scene.stop(active.scene.key);
    g.scene.start(k, sp ? { spawn: sp } : undefined);
  }, [key, spawn ?? null]);
  await sleep(2600);
}

/** 设置农田格子状态 */
export async function setTileState(page, col, row, state) {
  await page.evaluate(([c, r, s]) => window.debug.farm.setTileState(c, r, s), [col, row, state]);
}

/** 设置作物 */
export async function setCrop(page, col, row, crop) {
  await page.evaluate(([c, r, cr]) => window.debug.farm.setCrop(c, r, cr), [col, row, crop]);
}

/** 获取农田格子状态 */
export async function getTileState(page, col, row) {
  return page.evaluate(([c, r]) => window.debug.farm.getTileState(c, r), [col, row]);
}

/** 给予物品 */
export async function giveItem(page, item, count) {
  await page.evaluate(([i, c]) => window.debug.giveItem(i, c), [item, count]);
}

/** 推进到次日 */
export async function nextDay(page) {
  await page.evaluate(() => window.debug.nextDay());
  await sleep(500);
}

/** 设置时间 */
export async function setTime(page, hour, minute = 0) {
  await page.evaluate(([h, m]) => window.debug.setTime(h, m), [hour, minute]);
  await sleep(200);
}

/** 截图 */
export async function screenshot(page, name) {
  const { join, dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  const { mkdirSync } = await import('fs');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dir = join(__dirname, '..', 'reports', 'screenshots');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.png`);
  await page.screenshot({ path });
  return path;
}
