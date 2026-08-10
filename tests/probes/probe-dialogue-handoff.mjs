/**
 * Dialogue Contract Test — StoryDialogue 接力（handoff）契约验证
 *
 * 起源（2026-08-11 P0 修复）：
 *   probe-full-story-run 曾因「1 行 dialogue + onComplete 重启新 dialogue」卡死在 station_intro。
 *   根因：walkDialogue 用 `d.index !== before` 判定推进，但 play(newLines) 会重置 index=0，
 *   导致 before=0/after=0 → 误判未推进 → 提前 break → step 永远不推进。
 *
 * 职责（与 full-story 的分工）：
 *   - full-story：验证玩家完整流程是否通（端到端）
 *   - handoff   ：验证 StoryDialogue「单行→onComplete→新对话」契约不被破坏（单元契约）
 *
 * 同类风险场景（未来可能复现 bug 的地方）：
 *   - 夏雅心语 / 林澈独白 → 下一句对白
 *   - Chapter Banner 之后的第一句对白
 *   - CG 前后对白切换
 *   - 任何「1 行 dialogue + onComplete 启动新 dialogue」模式
 *
 * 设计原则（制作人否决"塞进 full-story 末尾"，要求独立 probe）：
 *   - 不复制游戏逻辑，只验证 StoryDialogue contract
 *   - 使用真实 StoryDialogue（从 window.__game.scene 拿，不 new、不 mock）
 *   - 使用真实 DOM（在游戏页面里执行）
 *   - 不依赖 Phaser import（StoryDialogue 构造函数纯 DOM + VoiceBank，已确认无 Phaser 依赖）
 *   - 视口红线：844×390 landscape + Android UA（与 full-story 一致）
 *
 * 断言：
 *   1. 行数 = 3（A → B → C 全部读到）
 *   2. 顺序 = ['A-line', 'B-line', 'C-line']（防止未来出现 A/C/B 错序）
 *   3. 最终对话关闭（handoff 链正常收尾）
 *
 * 前置：Vite dev server 在 localhost:5173
 * 运行：node tests/probes/probe-dialogue-handoff.mjs
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5175/?reset=1'; // 临时 5175（5173 被占用），验证后改回

const results = [];
function result(step, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  const msg = `${icon} ${step}${passed ? '' : ' - ' + detail}`;
  results.push(msg);
  console.log(msg);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 排空全屏 DOM 层（Chapter Banner / 音量提示 / 手机通知 / 列车声遮罩）。
 * 与 probe-full-story-run.dismissOverlays 同语义：zIndex >= 600 的可见 div 点中心关闭/翻页。
 * 独立实现避免跨 probe 耦合。
 */
async function dismissOverlays(page) {
  for (let round = 0; round < 5; round++) {
    let closedAny = false;
    for (let i = 0; i < 25; i++) {
      const hit = await page.evaluate(() => {
        const layers = [...document.querySelectorAll('div')].filter(d =>
          Number(d.style?.zIndex) >= 600 && d.style?.display !== 'none');
        if (layers.length === 0) return 'none';
        return { w: window.innerWidth / 2, h: window.innerHeight / 2 };
      });
      if (hit === 'none') break;
      await page.mouse.click(hit.w, hit.h);
      await sleep(700);
      closedAny = true;
    }
    if (!closedAny) break;
  }
  await sleep(600);
}

/**
 * 推进对话并记录全部行（与 probe-full-story-run.walkDialogue 同语义，独立实现避免跨 probe 耦合）。
 * 三状态检测：index / lines 引用 / isOpen 任一变化即视为推进。
 */
async function walkDialogue(page, maxLines = 10) {
  await sleep(400);
  const lines = [];
  for (let i = 0; i < maxLines; i++) {
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (d?.isOpen() && d.typing) d.advance();
    });
    await sleep(120);
    const cur = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (!d?.isOpen()) return null;
      const l = d.lines[d.index];
      return l ? { text: l.text ?? '' } : null;
    });
    if (!cur) break;
    lines.push(cur.text);
    // ⚠ 隐含契约：依赖 StoryDialogue.play() 当前实现 `this.lines = lines`（重新赋值），
    //    若未来改为 mutate（如 this.lines.length = 0; this.lines.push(...newLines)），
    //    引用不会变化，linesId 检测会失效，需同步调整为 lines 长度或首行文本比对。
    const before = await page.evaluate(() => {
      const d = window.__game.scene.getScenes(true)[0]?.storyDialogue;
      if (!d) return null;
      return { index: d.index, linesId: d.lines, isOpen: d.isOpen() };
    });
    if (!before) break;
    await page.evaluate(() => {
      const d = window.__game.scene.getScenes(true)[0]?.storyDialogue;
      if (d?.isOpen()) d.advance();
    });
    await sleep(180);
    const after = await page.evaluate(() => {
      const d = window.__game.scene.getScenes(true)[0]?.storyDialogue;
      if (!d) return null;
      return { index: d.index, linesId: d.lines, isOpen: d.isOpen() };
    });
    if (!after) break;
    const progressed =
      after.index !== before.index ||
      after.linesId !== before.linesId ||
      after.isOpen !== before.isOpen;
    if (!progressed) break;
    if (!after.isOpen) break;
  }
  await sleep(200);
  return lines;
}

async function run() {
  console.log('=== Dialogue Contract Test: 1行→onComplete→新对话 接力 ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [err] ${msg.text().substring(0, 160)}`);
  });

  try {
    // 移动端横屏 + Android UA（与 probe-full-story-run 一致，符合横屏红线）
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(2500);

    // 标题画面按 Enter 进入车站（与 probe-full-story-run 一致）
    await page.keyboard.press('Enter');
    await sleep(3000);

    // 等到游戏进入车站场景（StationScene.create 会创建 storyDialogue）
    let sceneReady = false;
    for (let i = 0; i < 20; i++) {
      const ok = await page.evaluate(() => {
        const s = window.__game?.scene?.getScenes(true)?.[0];
        return !!s?.storyDialogue;
      });
      if (ok) { sceneReady = true; break; }
      await sleep(400);
    }
    result('游戏场景就绪（storyDialogue 可用）', sceneReady, sceneReady ? '' : '20 次轮询未拿到 storyDialogue');
    if (!sceneReady) return;

    // 排空 Chapter Banner / 音量提示 / 手机通知（它们会阻塞开场对白时序）
    await dismissOverlays(page);
    // 08-09 P0 修订：通知关闭后 delayedCall(1000ms) 才播林澈情绪句独白 → 等 storyDialogue 打开
    let dialogueOpen = false;
    for (let i = 0; i < 30; i++) {
      const open = await page.evaluate(() => {
        const s = window.__game.scene.getScenes(true)[0];
        return s?.storyDialogue?.isOpen?.() ?? false;
      });
      if (open) { dialogueOpen = true; break; }
      await sleep(400);
    }
    result('车站开场对白打开', dialogueOpen, dialogueOpen ? '' : '12s 内未等到开场对白');
    if (!dialogueOpen) return;

    // 关闭现有对话（reset 不触发 onComplete，避免污染注入场景）
    await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      s?.storyDialogue?.reset?.();
    });
    await sleep(300);

    // 注入 handoff 测试场景：1 行 A → onComplete → 2 行 [B, C]
    // 用独特的 marker 文本，避免与游戏内对白混淆
    const injected = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      const d = s?.storyDialogue;
      if (!d) return false;
      d.play(
        [{ speaker: '测试', color: '#ffffff', text: 'A-line' }],
        () => {
          // onComplete：启动新对话（play 会重置 index=0 + 重新赋值 this.lines）
          d.play([
            { speaker: '测试', color: '#ffffff', text: 'B-line' },
            { speaker: '测试', color: '#ffffff', text: 'C-line' },
          ]);
        }
      );
      return true;
    });
    result('注入 handoff 对话（A → onComplete → B,C）', injected, '');
    if (!injected) return;

    // 跑 walker（与 probe-full-story-run 同语义）
    const lines = await walkDialogue(page, 10);

    // 断言 1：行数 = 3（A、B、C 全部读到）
    result('handoff 读到 3 行对话', lines.length === 3, `期望=3 实际=${lines.length} 行：${JSON.stringify(lines)}`);

    // 断言 2：顺序 = ['A-line', 'B-line', 'C-line']（防止未来 A/C/B 错序）
    const expected = ['A-line', 'B-line', 'C-line'];
    const orderOk = lines.length === 3 && lines.every((t, i) => t === expected[i]);
    result('handoff 顺序正确 A→B→C', orderOk, `期望=${JSON.stringify(expected)} 实际=${JSON.stringify(lines)}`);

    // 断言 3：最终对话关闭（handoff 链正常收尾，不残留）
    await sleep(500);
    const finallyClosed = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return !s?.storyDialogue?.isOpen?.();
    });
    result('handoff 链收尾对话关闭', finallyClosed, finallyClosed ? '' : '对话仍打开（walker 未推进到末行）');

    // 汇总
    const pass = results.filter(r => r.startsWith('✅')).length;
    const fail = results.filter(r => r.startsWith('❌')).length;
    console.log(`\n========== probe-dialogue-handoff 结果: ${pass} 通过 / ${fail} 失败 ==========`);
    if (fail > 0) process.exitCode = 1;
  } catch (e) {
    console.error('probe 异常:', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch(e => {
  console.error('未捕获异常:', e);
  process.exit(1);
});
