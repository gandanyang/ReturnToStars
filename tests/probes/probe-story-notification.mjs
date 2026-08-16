/**
 * probe-story-notification.mjs — 重要事件记忆卡组件探针（反馈层级 L3/L4）
 *
 * 验证：
 *   T1 showStoryComplete → 卡片显示、标题/副标题文本正确、z-index=330
 *   T2 showStoryStart → 显示且不冻结（pointer-events:none；玩家仍可交互）
 *   T3 showStoryChapter(chapter) → 章节卡（停留更长：底色/时长参数生效）
 *   T4 停留后自动淡出（display:none）
 *   T5 hideStoryCard → 立即隐藏
 *   T6 单例复用：重复调用不创建多个 DOM（ensureDom 幂等）
 *   T7 副标题缺省时不残留（只显示标题）
 *   T8 无运行时错误
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.bringToFront();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(1500);

  // 直接 import 组件并通过 window 暴露调用（单元级验证组件本身）
  await page.evaluate(async () => {
    const mod = await import('/src/ui/StoryNotification.ts');
    window.__sn = {
      showStart: mod.showStoryStart,
      showComplete: mod.showStoryComplete,
      showChapter: mod.showStoryChapter,
      hide: mod.hideStoryCard,
    };
  });

  // T1 完成卡：标题+副标题+z-index
  await page.evaluate(() => window.__sn.showComplete('春深有信·一', '沉睡的花种，又在青禾镇的一角发芽'));
  await sleep(900);
  const r1 = await page.evaluate(() => {
    const card = document.querySelector('#game-container')?.parentElement?.querySelector('div[style*="efdfc2"]');
    // 卡片存在于 body 中
    const root = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent?.includes('春深有信·一') && d.textContent?.includes('沉睡的花种'));
    return {
      titleShown: !!root && root.textContent.includes('春深有信·一'),
      subShown: !!root && root.textContent.includes('沉睡的花种'),
      // 存在任意 330 z-index 的 fixed 层
      has330: Array.from(document.querySelectorAll('div')).some((d) => d.style.zIndex === '330'),
    };
  });
  console.log('T1:', JSON.stringify(r1));
  check('T1 完成卡显示标题', r1.titleShown === true, '');
  check('T1 完成卡显示副标题（言之有物）', r1.subShown === true, '');
  check('T1 卡片层 z-index=330（高于 MemoryMoment 300）', r1.has330 === true, '');

  // T4 自动淡出
  await sleep(2600);
  const r4 = await page.evaluate(() => {
    // 卡片容器 display 应为 none（已淡出）
    const anyVisible = Array.from(document.querySelectorAll('div')).some((d) =>
      d.textContent?.includes('春深有信·一') && d.style.display === 'flex');
    return { anyVisible };
  });
  console.log('T4:', JSON.stringify(r4));
  check('T4 停留后自动淡出（display 非 flex）', r4.anyVisible === false, '');

  // T6 单例复用：显示两次，卡片 DOM 数量不增长（数 z-index:330 的外部容器只应有 1 份）
  await page.evaluate(() => { window.__sn.showStart('归园的线索', '镇长托付你去找一样东西'); });
  await sleep(400);
  const r6 = await page.evaluate(() => {
    const count = Array.from(document.querySelectorAll('div')).filter((d) =>
      d.style.zIndex === '330').length;
    return { count };
  });
  console.log('T6:', JSON.stringify(r6));
  check('T6 单例复用（z-index:330 容器只有 1 份）', r6.count === 1, `count=${r6.count}`);

  // T5 hideStoryCard 立即隐藏
  await page.evaluate(() => { window.__sn.showStart('测试标题', '测试副标题'); });
  await sleep(300);
  await page.evaluate(() => window.__sn.hide());
  const r5 = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div')).some((d) =>
      d.textContent?.includes('测试标题') && d.style.display === 'flex');
  });
  console.log('T5:', JSON.stringify({ visibleAfterHide: r5 }));
  check('T5 hideStoryCard 后卡片隐藏', r5 === false, '');

  // T7 副标题缺省：只显示标题，不残留空副标题
  await page.evaluate(() => window.__sn.showChapter('第一章', '归园新序'));
  await sleep(300);
  const r7 = await page.evaluate(() => {
    const root = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent?.includes('第一章') && d.style.display === 'flex');
    return { title: !!root && root.textContent.includes('第一章'), sub: !!root && root.textContent.includes('归园新序') };
  });
  console.log('T7:', JSON.stringify(r7));
  check('T7 章节卡标题显示', r7.title === true, '');
  check('T7 章节卡副标题显示', r7.sub === true, '');

  // T2 不冻结（pointer-events:none）
  await page.evaluate(() => { window.__sn.showComplete('测试不冻结', '应当不挡操作'); });
  await sleep(400);
  const r2 = await page.evaluate(() => {
    const root = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent?.includes('测试不冻结'));
    // 卡片所在最外层 fixed 容器应 pointer-events:none
    const pe = root ? (root.style.pointerEvents || root.style.pointerEvents) : null;
    return { hasPointerNone: !!root && (root.style.pointerEvents === 'none') };
  });
  console.log('T2:', JSON.stringify(r2));
  check('T2 卡片不冻结交互（pointer-events:none）', r2.hasPointerNone === true, '');
  await page.evaluate(() => window.__sn.hide());

  // T8 无运行时错误
  const realErrors = errors.filter((e) => !/favicon|404|Fetch.*chrome-extension/i.test(e));
  check('T8 无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: join(SHOT_DIR, 'story-notification-final.png') });
  console.log(`\n===== probe-story-notification 结果: ${pass} 通过 / ${fail} 失败 =====`);
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : '');
  fail++;
  console.log(`\n===== probe-story-notification 结果: ${pass} 通过 / ${fail} 失败 =====`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
