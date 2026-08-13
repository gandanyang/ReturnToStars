/**
 * probe-ch1-awakening.mjs — [A-1] 章节切换仪式感验证
 *
 * 验证项（2026-08-13 制作人拍板：观星夜结束→EndingPanel 关闭后触发 CH1_AWAKENING_DIALOGUE）：
 *   1. 源码层：CH1_AWAKENING_DIALOGUE 文案存在且含关键词（3 行：晨光/星星 + 新的家 + 老屋/整理）
 *   2. 源码层：MapScene 创建 EndingPanel 时注入了 onClose 回调
 *   3. 源码层：onClose 回调内调用 triggerOnce('ch1_awakening', ...)
 *   4. 运行时：triggerOnce('ch1_awakening') 一次性（首次 true，二次 false）
 *   5. 运行时：hasTriggered 标记正确
 *   6. 无运行时错误
 *
 * 验证策略：
 *   - 源码层用 fetch + 正则验证代码存在（不依赖运行时观星夜演出）
 *   - 运行时用 debug.events.triggerOnce 验证一次性语义
 *
 * 前置：dev server (localhost:5181)
 * 运行：node tests/probes/probe-ch1-awakening.mjs
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
const storySystemSrc = fs.readFileSync(path.join(ROOT, 'src', 'systems', 'StorySystem.ts'), 'utf-8');
const mapSceneSrc = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'MapScene.ts'), 'utf-8');

console.log('=== [A-1] 章节切换仪式感探针 ===\n');

// --- 1. CH1_AWAKENING_DIALOGUE 文案 ---
console.log('--- 1. CH1_AWAKENING_DIALOGUE 文案 ---');

const dialogueMatch = storySystemSrc.match(/export const CH1_AWAKENING_DIALOGUE[\s\S]*?\];/);
result('1.1 CH1_AWAKENING_DIALOGUE 定义存在', !!dialogueMatch, dialogueMatch ? '' : '未找到定义');

if (dialogueMatch) {
  const dialogueText = dialogueMatch[0];
  const hasLine1 = dialogueText.includes('晨光') && dialogueText.includes('星星');
  result('1.2 第1行含"晨光"+"星星"', hasLine1, dialogueText.slice(0, 200));

  const hasLine2 = dialogueText.includes('新的家');
  result('1.3 第2行含"新的家"', hasLine2);

  const hasLine3 = dialogueText.includes('老屋') && dialogueText.includes('整理');
  result('1.4 第3行含"老屋"+"整理"', hasLine3);

  const lineCount = (dialogueText.match(/\{ speaker:/g) || []).length;
  result('1.5 共 3 行对白', lineCount === 3, `实际 ${lineCount} 行`);
}

// --- 2. EndingPanel onClose 钩子 ---
console.log('\n--- 2. EndingPanel onClose 钩子 ---');

const onCloseMatch = mapSceneSrc.includes("new EndingPanel(()") ||
                     mapSceneSrc.includes("new EndingPanel(((");
result('2.1 MapScene 创建 EndingPanel 时传入 onClose 回调',
  onCloseMatch, '未找到 onClose 回调注入');

const triggerOnceMatch = mapSceneSrc.includes("triggerOnce('ch1_awakening'") ||
                         mapSceneSrc.includes('triggerOnce("ch1_awakening"');
result('2.2 onClose 内调用 triggerOnce("ch1_awakening")',
  triggerOnceMatch, '未找到 triggerOnce 调用');

const playMatch = mapSceneSrc.includes('CH1_AWAKENING_DIALOGUE') &&
                  mapSceneSrc.includes('storyDialogue') &&
                  mapSceneSrc.includes('.play(CH1_AWAKENING_DIALOGUE');
result('2.3 onClose 内调用 storyDialogue.play(CH1_AWAKENING_DIALOGUE)',
  playMatch, '未找到 play 调用');

const importMatch = mapSceneSrc.includes('CH1_AWAKENING_DIALOGUE,') ||
                    mapSceneSrc.match(/CH1_AWAKENING_DIALOGUE\s*[,}]/);
result('2.4 MapScene 导入了 CH1_AWAKENING_DIALOGUE', !!importMatch);

// ========== 运行时验证 ==========
console.log('\n--- 3. 运行时 triggerOnce 一次性 ---');

const SAVE = {
  version: '0.5', savedAt: 'awakening-probe', timestamp: Date.now(),
  player: { x: 400, y: 300, scene: 'farm', facing: 'down', inventory: {} },
  world: { day: 1, hour: 20, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'observatory_complete' },
  chapter: 1,
  gameState: { triggeredEvents: {} },
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);

  // 进入 farm
  const enterGame = async (scene, timeoutMs = 25000) => {
    const t0 = Date.now();
    let cur = '';
    while (Date.now() - t0 < timeoutMs) {
      try {
        cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      } catch { await sleep(300); continue; }
      if (cur === scene) return;
      if (cur === 'title') {
        await page.keyboard.press('Enter');
        await page.mouse.click(400, 300);
      }
      await sleep(350);
    }
    throw new Error(`未能进入 ${scene}（实际 ${cur}）`);
  };
  await enterGame('farm');
  await sleep(600);

  // 3.1 初始未触发
  let triggered = await page.evaluate(() => window.debug.events.hasTriggered('ch1_awakening'));
  result('3.1 初始 ch1_awakening 未触发', triggered === false, `hasTriggered=${triggered}`);

  // 3.2 首次 triggerOnce 返回 true
  let firstCall = await page.evaluate(() => {
    let called = false;
    const r = window.debug.events.triggerOnce('ch1_awakening', () => { called = true; });
    return { returned: r, called };
  });
  result('3.2 首次 triggerOnce 返回 true 且 fn 执行',
    firstCall.returned === true && firstCall.called === true,
    `returned=${firstCall.returned} called=${firstCall.called}`);

  // 3.3 标记已写入
  triggered = await page.evaluate(() => window.debug.events.hasTriggered('ch1_awakening'));
  result('3.3 标记后 hasTriggered=true', triggered === true, `hasTriggered=${triggered}`);

  // 3.4 二次 triggerOnce 返回 false 且 fn 不执行
  let secondCall = await page.evaluate(() => {
    let called = false;
    const r = window.debug.events.triggerOnce('ch1_awakening', () => { called = true; });
    return { returned: r, called };
  });
  result('3.4 二次 triggerOnce 返回 false 且 fn 不执行',
    secondCall.returned === false && secondCall.called === false,
    `returned=${secondCall.returned} called=${secondCall.called}`);

  // 3.5 存档序列化包含 ch1_awakening
  const saveData = await page.evaluate(() => window.debug.events.getSaveData());
  const inSave = saveData?.triggeredEvents?.ch1_awakening === true;
  result('3.5 存档序列化包含 ch1_awakening=true', inSave, JSON.stringify(saveData?.triggeredEvents).slice(0, 100));

  // ========== 4. 无运行时错误 ==========
  console.log('\n--- 4. 错误检查 ---');
  result('4.1 全程无运行时错误', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : '');

} catch (e) {
  console.log(`\n💥 探针异常：${e.message}`);
  console.log(e.stack);
  fail++;
} finally {
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
