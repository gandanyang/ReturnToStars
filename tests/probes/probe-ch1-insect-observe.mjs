/**
 * probe-ch1-insect-observe.mjs — 第一章 P2「自然记录」第三段昆虫观察（青禾凤蝶→小梅放大镜）验证
 *
 * 验证项（2026-08-13 制作人拍板：观察→记录→连接生命，对话选项逐观察，需青禾凤蝶标本）：
 *   源码层：
 *     1. XIAOMEI_OBSERVE_* 台词存在（StorySystem.ts）
 *     2. tryXiaomeiObserve / playXiaomeiObserveChoices 方法存在（MapScene.ts）
 *     3. tryInteract 内 gardener + 有标本 + 未解锁 → 优先触发观察
 *     4. 三项观察完成 → triggerOnce('ch1_natural_record_1')
 *     5. 未集齐 → 继续下一轮选项
 *   运行时：
 *     6. 靠近小梅（背包有标本）→ 触发小梅递放大镜对白
 *     7. 选项行出现（看翅膀/看时间/看环境）
 *     8. 选一项 → 播放对应小梅引导台词
 *     9. 选完三项 → triggeredEvents.ch1_natural_record_1 = true + 收束台词
 *    10. 解锁后再次靠近小梅 → 不再触发观察（一次性）
 *    11. 无运行时错误
 *
 * 前置：dev server (localhost:5173)
 * 运行：node tests/probes/probe-ch1-insect-observe.mjs
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

console.log('=== 第一章 P2「自然记录」昆虫观察（青禾凤蝶→小梅）探针 ===\n');

// --- 1. 台词存在 ---
console.log('--- 1. XIAOMEI_OBSERVE 台词 ---');
result('1.1 小梅递放大镜引导对白存在',
  /export const XIAOMEI_OBSERVE_INTRO_DIALOGUE/.test(storySrc));
result('1.2 观察选项行存在（看翅膀/看时间/看环境）',
  /options: \['看翅膀的颜色', '看它什么时候出现', '看它喜欢待在哪里'\]/.test(storySrc));
result('1.3 逐项观察引导台词存在（3 组）',
  /export const XIAOMEI_OBSERVE_DETAIL_DIALOGUE\s*:\s*DialogueLine\[\]\[\]/.test(storySrc));
result('1.4 收束对白含点睛台词"原来它们一直都在"',
  /原来它们一直都在。只是我们以前，没认真看过/.test(storySrc));
result('1.5 收束对白提及"青禾镇的自然记录，这是第一条"',
  /青禾镇的自然记录，这是第一条/.test(storySrc));

// --- 2. 方法存在 ---
console.log('\n--- 2. 方法定义 ---');
result('2.1 tryXiaomeiObserve 方法存在',
  /private tryXiaomeiObserve\(\): void/.test(mapSceneSrc));
result('2.2 playXiaomeiObserveChoices 方法存在',
  /private playXiaomeiObserveChoices\(\): void/.test(mapSceneSrc));
result('2.3 三项集齐 → triggerOnce("ch1_natural_record_1")',
  /xiaomeiObserveSeen\.every\(Boolean\)[\s\S]*?triggerOnce\('ch1_natural_record_1'/.test(mapSceneSrc));
result('2.4 未集齐 → 继续下一轮',
  /else \{[\s\S]*?this\.playXiaomeiObserveChoices\(\)/.test(mapSceneSrc));
result('2.5 完成反馈 memory moment 计数动态化（1/10 · 2/10 · 3/10）',
  /showMemoryMoment\('青禾镇自然记录 1\/10 · 青禾凤蝶'\)/.test(mapSceneSrc) &&
  /showMemoryMoment\('青禾镇自然记录 2\/10 · 柳叶蝶'\)/.test(mapSceneSrc) &&
  /showMemoryMoment\('青禾镇自然记录 3\/10 · 夜光蛾'\)/.test(mapSceneSrc));

// --- 3. tryInteract 分支 ---
console.log('\n--- 3. tryInteract 分支 ---');
result('3.1 gardener + 有标本 + 未解锁 → 触发观察',
  /nearest\.id === 'gardener' && getItemCount\('butterfly_specimen'\) > 0 && !hasTriggered\('ch1_natural_record_1'\)[\s\S]*?this\.tryXiaomeiObserve\(\)/.test(mapSceneSrc));
result('3.2 MapScene import 观察台词',
  /XIAOMEI_OBSERVE_INTRO_DIALOGUE, XIAOMEI_OBSERVE_CHOICES_DIALOGUE, XIAOMEI_OBSERVE_DETAIL_DIALOGUE, XIAOMEI_OBSERVE_DONE_DIALOGUE/.test(mapSceneSrc));

// ========== 运行时验证 ==========
console.log('\n--- 4. 运行时验证 ---');

// SAVE：第一章 + 教程完成 + 白天 10:00 + 玩家在 farm（小梅 07:00-14:00 在 farm 花圃）+ 背包有青禾凤蝶标本
const SAVE = {
  version: '0.5', savedAt: 'insect-observe-probe', timestamp: Date.now(),
  player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: { butterfly_specimen: 1 } },
  world: { day: 1, hour: 10, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'observatory_complete' },
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

  // 4.1 小梅在 farm（白天 07:00-14:00 在花圃）
  let meiInfo = await page.evaluate(() => {
    const s = window.__game?.scene.getScenes(true)[0];
    const mei = s?.npcList?.find((n) => n.id === 'gardener');
    return { has: !!mei, visible: !!mei?.sprite?.visible, x: mei?.sprite?.x, y: mei?.sprite?.y };
  });
  result('4.1 小梅白天在 farm（可见）', meiInfo.visible === true, JSON.stringify(meiInfo));

  // 4.2 靠近小梅触发观察（背包有标本）
  let triggerResult = await page.evaluate(() => {
    const s = window.__game?.scene.getScenes(true)[0];
    if (!s) return { ok: false, reason: 'no scene' };
    try { s.storyDialogue?.close?.(); } catch (e) { /* ignore */ }
    const mei = s.npcList?.find((n) => n.id === 'gardener');
    if (!mei?.sprite) return { ok: false, reason: 'no mei' };
    s.tryXiaomeiObserve();
    return {
      ok: true,
      dlgOpen: !!s.storyDialogue?.isOpen?.(),
      line: s.storyDialogue?.textEl?.textContent ?? '',
    };
  });
  result('4.2 触发小梅递放大镜引导对白', triggerResult.ok && triggerResult.dlgOpen, JSON.stringify(triggerResult));

  // 4.3 推进到选项行
  let choiceState = { open: false, optionsShown: false, optionText: '' };
  for (let i = 0; i < 30; i++) {
    choiceState = await page.evaluate(() => {
      const s = window.__game?.scene.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      return {
        open: !!dlg?.isOpen?.(),
        optionsShown: !!(dlg?.optionsEl && dlg.optionsEl.style.display !== 'none'),
        optionText: dlg?.optionsEl ? dlg.optionsEl.textContent : '',
      };
    });
    if (choiceState.optionsShown) break;
    if (!choiceState.open) break;
    await page.evaluate(() => {
      const s = window.__game?.scene.getScenes(true)[0];
      s?.storyDialogue?.advance?.();
    });
    await sleep(400);
  }
  result('4.3 观察选项行出现（看翅膀/看时间/看环境）',
    choiceState.open && choiceState.optionsShown &&
    choiceState.optionText.includes('看翅膀的颜色') &&
    choiceState.optionText.includes('看它什么时候出现'),
    JSON.stringify(choiceState));

  // 4.4-4.6 依次选三个选项（0/1/2），每选一项后推进详情台词，再触发下一轮选项
  const pickAndRead = async (btnIdx) => {
    // 点选项
    await page.evaluate((idx) => {
      const s = window.__game?.scene.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      const btns = dlg?.optionsEl?.querySelectorAll('button');
      if (btns && btns[idx]) btns[idx].click();
    }, btnIdx);
    await sleep(400);
    // 推进详情台词到结束：累积所有非空正文（含详情台词，可能越过到下一轮选项），供关键字断言
    let detailLine = '';
    for (let i = 0; i < 8; i++) {
      const st = await page.evaluate(() => {
        const s = window.__game?.scene.getScenes(true)[0];
        const dlg = s?.storyDialogue;
        return {
          text: dlg?.textEl?.textContent ?? '',
          optionsShown: !!(dlg?.optionsEl && dlg.optionsEl.style.display !== 'none'),
          open: !!dlg?.isOpen?.(),
        };
      });
      if (st.text && !st.optionsShown) detailLine += st.text + ' ';
      if (st.optionsShown || !st.open) break;
      await page.evaluate(() => {
        const s = window.__game?.scene.getScenes(true)[0];
        s?.storyDialogue?.advance?.();
      });
      await sleep(400);
    }
    return detailLine;
  };

  const detail0 = await pickAndRead(0);
  result('4.4 观察翅膀 → 小梅引导台词（"这种蓝，只有青禾镇的花丛附近才有"）',
    detail0.includes('青禾镇的花丛附近') || detail0.includes('水晕'), JSON.stringify(detail0));

  const detail1 = await pickAndRead(1);
  result('4.5 观察时间 → 小梅引导台词（"天太热了，它就去花影里歇着"）',
    detail1.includes('花影里歇着') || detail1.includes('清早和傍晚'), JSON.stringify(detail1));

  const detail2 = await pickAndRead(2);
  result('4.6 观察环境 → 小梅引导台词（"花在，它就在"）',
    detail2.includes('花在，它就在') || detail2.includes('认得这片花'), JSON.stringify(detail2));

  // 4.7 三项集齐 → 收束台词 + triggerOnce
  await sleep(600);
  // 推进收束对白到末句（"原来它们一直都在"），再断言
  let doneState = { line: '', triggered: false };
  for (let i = 0; i < 10; i++) {
    doneState = await page.evaluate(() => {
      const s = window.__game?.scene.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      return {
        line: dlg?.textEl?.textContent ?? '',
        triggered: window.debug?.events?.hasTriggered?.('ch1_natural_record_1') ?? false,
      };
    });
    if (doneState.line.includes('原来它们一直都在')) break;
    const st = await page.evaluate(() => {
      const s = window.__game?.scene.getScenes(true)[0];
      const dlg = s?.storyDialogue;
      return {
        optionsShown: !!(dlg?.optionsEl && dlg.optionsEl.style.display !== 'none'),
        open: !!dlg?.isOpen?.(),
      };
    });
    if (st.optionsShown || !st.open) break;
    await page.evaluate(() => {
      const s = window.__game?.scene.getScenes(true)[0];
      s?.storyDialogue?.advance?.();
    });
    await sleep(400);
  }
  result('4.7 三项观察完成 → ch1_natural_record_1 = true',
    doneState.triggered === true, JSON.stringify(doneState));
  result('4.8 收束台词含"原来它们一直都在"',
    doneState.line.includes('原来它们一直都在'), JSON.stringify(doneState));

  // 4.9 完结后再次靠近小梅 → 不再触发观察（一次性）
  let noRepeat = await page.evaluate(() => {
    const s = window.__game?.scene.getScenes(true)[0];
    const mei = s?.npcList?.find((n) => n.id === 'gardener');
    if (!mei?.sprite) return { ok: false, reason: 'no mei' };
    // 直接调用 tryXiaomeiObserve：若已解锁，应被 tryInteract 分支拦截（此处验证 hasTriggered 守卫）
    const guard = window.debug?.events?.hasTriggered?.('ch1_natural_record_1');
    return { guard, hasSpecimen: window.debug?.getItemCount?.('butterfly_specimen') };
  });
  result('4.9 解锁后不再触发（hasTriggered 守卫为 true）', noRepeat.guard === true, JSON.stringify(noRepeat));

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