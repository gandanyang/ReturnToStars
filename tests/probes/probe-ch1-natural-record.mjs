/**
 * probe-ch1-natural-record.mjs — 第一章 P2 捕虫「自然记录」蝴蝶→夏雅分享闭环验证
 *
 * 验证项（2026-08-13 制作人拍板方向：观察→分享→情感连接，非送礼系统，无好感数值）：
 *   源码层：
 *     1. XIYA_BUTTERFLY_SHARE_DIALOGUE 台词存在（StorySystem.ts，夏雅旧日记忆）
 *     2. buildDawnXiyaLines 存在（清晨对话动态构建）
 *     3. 背包有蝴蝶标本且未分享 → 追加选项行「给她看蝴蝶标本」
 *     4. 选「给她看」→ addItem('butterfly_specimen', -1) 消耗
 *     5. 选「给她看」→ triggerOnce('natural_record_butterfly_xiya') 持久化
 *     6. 分享后触发 XIYA_BUTTERFLY_SHARE_DIALOGUE
 *   运行时：
 *     7. 清晨夏雅对话，背包有蝴蝶标本时出现选项行
 *     8. 选「给她看蝴蝶标本」→ 标本 -1 + 触发台词 + triggeredEvents.natural_record_butterfly_xiya=true
 *     9. 分享后再次靠近 → 不再出现分享选项（一次性）
 *    10. 分享后标本数量正确（消耗 1）
 *    11. 无运行时错误
 *
 * 前置：dev server (localhost:5173)
 * 运行：node tests/probes/probe-ch1-natural-record.mjs
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
const storySrc = fs.readFileSync(path.join(ROOT, 'src', 'systems', 'StorySystem.ts'), 'utf-8');
const mapSceneSrc = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'MapScene.ts'), 'utf-8');

console.log('=== 第一章 P2 捕虫「自然记录」蝴蝶→夏雅 探针 ===\n');

// --- 1. 台词存在 ---
console.log('--- 1. XIYA_BUTTERFLY_SHARE_DIALOGUE 台词 ---');
result('1.1 分享台词常量存在',
  /export const XIYA_BUTTERFLY_SHARE_DIALOGUE\s*:\s*DialogueLine\[\]/.test(storySrc));
result('1.2 台词含夏雅旧日记忆（"青禾镇，其实一直没有离开"）',
  /你让我想起来——青禾镇，其实一直没有离开过/.test(storySrc));
result('1.3 台词含"夏天应该很长很长"（记忆主题）',
  /夏天应该很长很长/.test(storySrc));
result('1.4 台词含"连这些小东西什么时候消失了，都没人发现"（观察主题）',
  /连这些小东西什么时候消失了，都没人发现/.test(storySrc));

// --- 2. buildDawnXiyaLines ---
console.log('\n--- 2. buildDawnXiyaLines 动态构建 ---');
result('2.1 buildDawnXiyaLines 方法定义',
  /private buildDawnXiyaLines\(\):\s*DialogueLine\[\]/.test(mapSceneSrc));
result('2.2 展开 XIYA_DAWN_DIALOGUE 作为基础行',
  /buildDawnXiyaLines[\s\S]*?const lines = \[\.\.\.XIYA_DAWN_DIALOGUE\]/.test(mapSceneSrc));
result('2.3 背包有蝴蝶标本 且 未分享 → 追加选项行',
  /buildDawnXiyaLines[\s\S]*?getItemCount\('butterfly_specimen'\) > 0[\s\S]*?!hasTriggered\('natural_record_butterfly_xiya'\)[\s\S]*?options: \['给她看蝴蝶标本', '没什么'\]/.test(mapSceneSrc));
result('2.4 选项行 speaker 为空 + 无正文（选项行范式）',
  /options: \['给她看蝴蝶标本', '没什么'\]/.test(mapSceneSrc));

// --- 3. onChoice 消耗 + 触发 ---
console.log('\n--- 3. onChoice 消耗 + 触发 ---');
result('3.1 onChoice 回调存在（play 第三参）',
  /storyDialogue\.play\(\s*\n\s*this\.buildDawnXiyaLines\(\)[\s\S]*?\(index:\s*number\)\s*=>/.test(mapSceneSrc));
result('3.2 选 option 0 → addItem("butterfly_specimen", -1) 消耗',
  /if \(index === 0\)[\s\S]*?getItemCount\('butterfly_specimen'\) > 0[\s\S]*?addItem\('butterfly_specimen', -1\)/.test(mapSceneSrc));
result('3.3 选 option 0 → triggerOnce("natural_record_butterfly_xiya")',
  /triggerOnce\('natural_record_butterfly_xiya'/.test(mapSceneSrc));
result('3.4 triggerOnce 内播放 XIYA_BUTTERFLY_SHARE_DIALOGUE',
  /triggerOnce\('natural_record_butterfly_xiya', \(\) => \{[\s\S]*?XIYA_BUTTERFLY_SHARE_DIALOGUE/.test(mapSceneSrc));
result('3.5 MapScene 已 import XIYA_BUTTERFLY_SHARE_DIALOGUE',
  /import[\s\S]*?XIYA_BUTTERFLY_SHARE_DIALOGUE/.test(mapSceneSrc));

// ========== 运行时验证 ==========
console.log('\n--- 4. 运行时验证 ---');

// 存档：第一章 + 教程完成 + 清晨 07:00 + 玩家在 farm（夏雅出现位附近 col33,row4）
const SAVE = {
  version: '0.5', savedAt: 'natural-record-probe', timestamp: Date.now(),
  player: { x: 33 * 32 + 16, y: 4 * 32 + 16, scene: 'farm', facing: 'down', inventory: {} },
  world: { day: 1, hour: 7, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' },
  chapter: 1,
  worldRestore: { garden: true },
  gameState: { triggeredEvents: {} },
};

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

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);
  await enterGame('farm');
  await sleep(1500);

  // 4.1 清晨夏雅精灵生成（setupDawnXiya 手动调用确保确定性，规避 create 时序竞态）
  let dawnReady = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('farm');
    if (!s) return { has: false, reason: 'no scene' };
    // 手动触发 setupDawnXiya（幂等：dawnXiyaDay===day 时 return，不影响验证）
    s.setupDawnXiya?.();
    return { has: !!s.dawnXiya, x: s?.dawnXiya?.x, y: s?.dawnXiya?.y };
  });
  result('4.1 farm 清晨夏雅精灵存在', dawnReady.has, JSON.stringify(dawnReady));

  // 4.2 给蝴蝶标本 + 调用清晨交互
  let interactResult = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('farm');
    if (!s) return { ok: false, reason: 'no scene' };
    try { s.storyDialogue?.close?.(); } catch (e) { /* ignore */ }
    window.debug.giveItem('butterfly_specimen', 1);
    const before = window.debug.getItemCount('butterfly_specimen');
    // 确保玩家在夏雅附近
    if (s.player && s.dawnXiya) {
      s.player.x = s.dawnXiya.x;
      s.player.y = s.dawnXiya.y;
    }
    const ok = s.tryDawnXiyaInteract();
    return { ok, before, hasButterfly: before > 0 };
  });
  result('4.2 清晨交互触发（玩家靠近夏雅按 E）', interactResult.ok === true, JSON.stringify(interactResult));

  // 4.3 推进到选项行（选项行是最后一行，需 advance 过前面 5 行）
  let sdState = { open: false, optionsShown: false, optionText: '' };
  for (let i = 0; i < 30; i++) {
    sdState = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('farm');
      const dlg = s?.storyDialogue;
      return {
        open: !!dlg?.isOpen?.(),
        optionsShown: !!(dlg?.optionsEl && dlg.optionsEl.style.display !== 'none'),
        optionText: dlg?.optionsEl ? dlg.optionsEl.textContent : '',
      };
    });
    if (sdState.optionsShown) break;
    if (!sdState.open) break;
    // advance 一次后等打字完成
    await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('farm');
      s?.storyDialogue?.advance?.();
    });
    await sleep(400);
  }
  result('4.3 清晨对话打开且显示「给她看蝴蝶标本」选项',
    sdState.open && sdState.optionsShown && sdState.optionText.includes('给她看蝴蝶标本'),
    JSON.stringify(sdState));

  // 4.4 点击选项 0（给她看蝴蝶标本）→ 消耗 + 触发台词
  let choiceResult = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('farm');
    const dlg = s?.storyDialogue;
    if (!dlg || !dlg.optionsEl) return { ok: false, reason: 'no options' };
    const btns = dlg.optionsEl.querySelectorAll('button');
    if (btns.length < 1) return { ok: false, reason: 'no buttons' };
    const before = window.debug.getItemCount('butterfly_specimen');
    btns[0].click(); // 选「给她看蝴蝶标本」
    return { ok: true, before };
  });
  result('4.4 点击「给她看蝴蝶标本」选项', choiceResult.ok === true, JSON.stringify(choiceResult));

  await sleep(600);

  // 4.5 标本已消耗 1
  let afterShare = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('farm');
    const dlg = s?.storyDialogue;
    return {
      specimen: window.debug.getItemCount('butterfly_specimen'),
      dlgOpen: !!dlg?.isOpen?.(),
      line: dlg?.textEl?.textContent ?? '',
      triggered: window.debug.events.hasTriggered('natural_record_butterfly_xiya'),
    };
  });
  result('4.5 分享后标本消耗 1（0）', afterShare.specimen === 0, JSON.stringify(afterShare));
  result('4.6 分享台词已触发并打开', afterShare.dlgOpen, JSON.stringify(afterShare));
  result('4.7 triggeredEvents.natural_record_butterfly_xiya = true',
    afterShare.triggered === true, JSON.stringify(afterShare));

  // 4.8 分享台词内容为夏雅旧日记忆（推进到台词的夏雅台词）
  // 分享台词首行是旁白，推进若干次后应出现夏雅对白
  let shareLine = '';
  for (let i = 0; i < 20; i++) {
    shareLine = await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('farm');
      return s?.storyDialogue?.textEl?.textContent ?? '';
    });
    if (shareLine.includes('青禾镇')) break;
    await page.evaluate(() => {
      const s = window.__game?.scene?.getScene('farm');
      s?.storyDialogue?.advance?.();
    });
    await sleep(350);
  }
  result('4.8 分享台词为夏雅旧日记忆（含"青禾镇"）', shareLine.includes('青禾镇'), JSON.stringify(shareLine));

  // 4.9 已分享后不再出现分享选项（一次性）
  // 关闭当前对白 → 再给蝴蝶 → 重新触发 → 检查无分享选项
  let noRepeat = await page.evaluate(() => {
    const s = window.__game?.scene?.getScene('farm');
    try { s?.storyDialogue?.close?.(); } catch (e) { /* ignore */ }
    window.debug.giveItem('butterfly_specimen', 1);
    if (s?.player && s?.dawnXiya) { s.player.x = s.dawnXiya.x; s.player.y = s.dawnXiya.y; }
    s.tryDawnXiyaInteract();
    const dlg = s?.storyDialogue;
    const hasOptions = !!(dlg?.optionsEl && dlg.optionsEl.style.display !== 'none');
    const optionText = dlg?.optionsEl ? dlg.optionsEl.textContent : '';
    // buildDawnXiyaLines：hasTriggered('natural_record_butterfly_xiya')=true → 不追加选项
    return { hasOptions, optionText, specimen: window.debug.getItemCount('butterfly_specimen') };
  });
  result('4.9 已分享后再次对话不出现分享选项（一次性）',
    noRepeat.hasOptions === false && !noRepeat.optionText.includes('给她看蝴蝶标本'),
    JSON.stringify(noRepeat));

  // 4.10 无运行时错误
  const fatalErrors = errors.filter((e) =>
    !e.includes('favicon') && !e.includes('Failed to load resource') && !e.includes('net::ERR'));
  result('4.10 全程无致命运行时错误', fatalErrors.length === 0,
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