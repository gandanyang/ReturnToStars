/**
 * probe-music-v1.mjs — 声音补全计划 v1.0 验证探针
 *
 * 验证：
 * T1 青禾镇白天 → BGM=town（专属日常音乐）
 * T2 青禾镇夜晚 → BGM=stargaze_night（不误播 town）
 * T3 春深有信 A 段触发 → BGM=spring_letter（专属音乐起播）
 * T4 春深有信 D 段收尾 → BGM=farm_day（恢复农场地图音乐）
 *
 * 依赖：dev server (localhost:5173) + window.debug.musicCurrent 钩子
 * 视口：横屏 1024x768（项目红线：禁止竖屏视口）
 * 时序策略：Vite 懒加载首编慢 → 全部轮询等待（life-moments 教训），不用固定 sleep 断言
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0;
let fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const musicWarns = [];
page.on('console', (msg) => {
  if (msg.text().includes('[MusicSystem] 加载失败')) musicWarns.push(msg.text());
});
page.on('pageerror', (e) => musicWarns.push('pageerror: ' + e.message));

/** 轮询等待：场景存在且 player 就绪 */
async function waitScene(key, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!s && !!s.player;
    }, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}

/** 轮询等待：musicCurrent 达到期望值 */
async function waitMusic(expect, timeout = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const cur = await page.evaluate(() => window.debug.musicCurrent?.() ?? null);
    if (cur === expect) return cur;
    await sleep(250);
  }
  return await page.evaluate(() => window.debug.musicCurrent?.() ?? null);
}

/** 推进对白直到关闭（长对白：打字机每句需 2-3 次 advance，上限给足） */
async function closeDialogue() {
  for (let i = 0; i < 60; i++) {
    const open = await page.evaluate(() => window.__game?.scene?.getScene?.('farm')?.storyDialogue?.isOpen?.() ?? false);
    if (!open) return true;
    await page.evaluate(() => window.__game.scene.getScene('farm').storyDialogue.advance());
    await sleep(250);
  }
  return false;
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => {
    const b = document.getElementById('intro-skip-btn');
    if (b) b.click();
  });
  await sleep(500);
  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.setTime(15, 0);
    window.debug.events?.markTriggered?.('first_morning_response');
  });
  await sleep(400);

  // ── T1 青禾镇白天 → town ──
  await page.evaluate(() => { window.__game.scene.start('town', { spawn: { x: 200, y: 300 } }); });
  const t1ok = await waitScene('town');
  const cur1 = t1ok ? await waitMusic('town') : null;
  result('T1 青禾镇白天 BGM=town', t1ok && cur1 === 'town', `scene=${t1ok} music=${cur1}`);

  // ── T2 青禾镇夜晚 → stargaze_night ──
  await page.evaluate(() => {
    window.debug.setTime(21, 0);
    window.__game.scene.start('town', { spawn: { x: 200, y: 300 } });
  });
  const t2ok = await waitScene('town');
  const cur2 = t2ok ? await waitMusic('stargaze_night') : null;
  result('T2 青禾镇夜晚 BGM=stargaze_night', t2ok && cur2 === 'stargaze_night', `scene=${t2ok} music=${cur2}`);

  // ── T3 春深有信 A 段 → spring_letter ──
  await page.evaluate(() => {
    window.debug.setTime(15, 0);
    window.__game.scene.start('farm', { spawn: { x: 200, y: 300 } });
  });
  const t3ok = await waitScene('farm');
  // 等剧情夏雅生成
  let xiyaOk = false;
  const t3t0 = Date.now();
  while (Date.now() - t3t0 < 10000) {
    xiyaOk = await page.evaluate(() => !!window.__game?.scene?.getScene?.('farm')?.letterXiya);
    if (xiyaOk) break;
    await sleep(300);
  }
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    if (s.letterXiya) { s.player.x = s.letterXiya.x + 12; s.player.y = s.letterXiya.y + 10; }
    s.player.facing = 'down';
  });
  await sleep(300);
  // 直接调场景方法测逻辑（输入链依赖页面焦点，life-moments/bug046 先例）
  const r3 = await page.evaluate(() => window.__game.scene.getScene('farm').tryXiyaLetterInteract());
  const cur3 = await waitMusic('spring_letter');
  result('T3 春深有信A段 BGM=spring_letter', xiyaOk && r3 === true && cur3 === 'spring_letter', `xiya=${xiyaOk} ret=${r3} music=${cur3}`);

  // ── T4 春深有信 D 段收尾 → 恢复 farm_day ──
  await closeDialogue(); // 关掉 A 段对白
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    // 强制进入 D 段状态（跳过 B/C，只验证音乐收尾逻辑）
    s.xiyaLetterStage = 3;
    s.xiyaLetterAsked = true;
    s.xiyaLetterDone = false;
    s.letterFlowerMark = null;
    s.letterRecordMark = null;
    if (!s.letterXiya) s.spawnLetterXiya();
    if (s.letterXiya) { s.player.x = s.letterXiya.x + 12; s.player.y = s.letterXiya.y + 10; }
  });
  await sleep(400);
  const r4 = await page.evaluate(() => window.__game.scene.getScene('farm').tryXiyaLetterInteract());
  const d4 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    return { done: s.xiyaLetterDone, stage: s.xiyaLetterStage, dlg: s.storyDialogue?.isOpen?.() ?? false };
  });
  console.log('[diag] T4 触发: ret=' + r4 + ' ' + JSON.stringify(d4));
  const cur4a = await waitMusic('spring_letter', 5000);
  result('T4a D段对白中 BGM=spring_letter(持续)', cur4a === 'spring_letter', cur4a);
  // 推进 D 段对白到结束 → 回调恢复 farm_day
  await closeDialogue();
  const cur4 = await waitMusic('farm_day');
  result('T4 春深有信收尾 BGM=farm_day', cur4 === 'farm_day', cur4);

  // 附加：无加载失败
  result('附加 无 [MusicSystem] 加载失败/页面错误', musicWarns.length === 0, musicWarns.join('; ').slice(0, 120));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-music-v1 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
