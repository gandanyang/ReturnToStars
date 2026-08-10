/**
 * Chapter Banner 系统回归探针（D-020 制作人 2026-08-10 拍板）
 *
 * 验证：
 *   1. 新档首访：station 开场自动弹出 Chapter 0「归途」Banner（DOM .chapter-banner 出现，含 CHAPTER 0 / 归途 / 副句）
 *   2. 跳过开场按钮（zIndex 9999）在 Banner 之上仍可点击 → 点击后 Banner 消失
 *   3. showChapterBanner API 手动调用可用（模块级单例，DOM 正确生成，点击可提前结束）
 *
 * 直接经 Vite 动态 import 生产模块，避开共享 5173 的 HMR 干扰。
 * 用法：GAME_URL=http://localhost:5174/ node tests/probes/probe-chapter-banner.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5174/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(page, fn, timeout = 12000, step = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}

async function run() {
  console.log('=== Chapter Banner 系统回归 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: true,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  let fails = 0;
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails++;
  };

  try {
    // 新档：清掉 localStorage，确保 station_intro 首访 + chapter1_arrival 未触发
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1500);

    // 0. 标题画面：点击任意处开始游戏 → 进入 station（Chapter 0 Banner 在站台开场黑屏期弹出）
    const titleReady = await waitFor(page, () =>
      page.evaluate(() => {
        // 标题画面有"开始游戏"提示文本
        return [...document.querySelectorAll('canvas')].length > 0;
      }), 10000);
    check('标题画面就绪（canvas 存在）', titleReady);
    if (titleReady) {
      await page.mouse.click(512, 384); // 点击开始
    }

    // 1. Chapter 0 Banner 自动出现（标题后黑屏期）
    const bannerShown = await waitFor(page, () =>
      page.evaluate(() => {
        const b = document.querySelector('.chapter-banner');
        return !!b && b.textContent.includes('CHAPTER 0') && b.textContent.includes('归途');
      }), 15000);
    check('Chapter 0「归途」Banner 自动出现', bannerShown, bannerShown ? '命中' : '15s 未出现');

    // 2. Banner 文案完整性（含副句，制作人定稿）
    const text = await page.evaluate(() => {
      const b = document.querySelector('.chapter-banner');
      return b ? b.textContent : '';
    });
    check('Banner 文案完整（含副句）',
      text.includes('CHAPTER 0') && text.includes('归途') && text.includes('有些地方，离开很久，也还是会等你回来。'),
      text.replace(/\s+/g, ' ').slice(0, 60));

    // 3. 跳过开场按钮在 Banner 之上可点 → 点击后 Banner 消失
    const skipClickable = await waitFor(page, () =>
      page.evaluate(() => {
        const btn = document.getElementById('intro-skip-btn');
        if (!btn) return false;
        const banner = document.querySelector('.chapter-banner');
        const btnZ = parseInt(getComputedStyle(btn).zIndex, 10) || 0;
        const bannerZ = banner ? parseInt(getComputedStyle(banner).zIndex, 10) || 0 : 0;
        return btnZ > bannerZ;
      }), 8000);
    check('跳过按钮层级 > Banner（可跳过）', skipClickable);
    if (skipClickable) {
      await page.evaluate(() => { const b = document.getElementById('intro-skip-btn'); if (b) b.click(); });
      const bannerGone = await waitFor(page, () =>
        page.evaluate(() => !document.querySelector('.chapter-banner')), 6000);
      check('点击跳过 → Banner 消失', bannerGone);
    }

    // 4. showChapterBanner API 手动调用（模块级单例）
    const apiOk = await page.evaluate(async () => {
      const mod = await import('/src/ui/ChapterBanner.ts');
      const p = mod.showChapterBanner({ chapter: 'CHAPTER 9', title: 'API测试', subtitle: '手动调用可用' });
      await new Promise(r => setTimeout(r, 500));
      const b = document.querySelector('.chapter-banner');
      const ok = !!b && b.textContent.includes('CHAPTER 9') && b.textContent.includes('API测试');
      mod.cancelChapterBanner();
      await p; // 取消后 resolve
      return ok;
    });
    check('showChapterBanner API 手动调用 + cancel', apiOk);

    // 5. Chapter 1 挂点静态校验：farm 首次进入 triggerOnce('chapter1_arrival') 存在
    //    （vite 返回编译后 JS，引号为双引号；仅验证 key 与文案存在）
    const hook = await page.evaluate(async () => {
      const src = await (await fetch('/src/scenes/MapScene.ts')).text();
      return src.includes('chapter1_arrival') && src.includes('回到归星岛');
    });
    check('Chapter 1 挂点存在（chapter1_arrival + 文案）', hook);

    const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
    check('无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

    console.log(`\n${fails === 0 ? '🎉 全部通过' : `⚠️ ${fails} 项失败`}`);
  } finally {
    await browser.close();
  }
  process.exit(fails === 0 ? 0 : 1);
}

run().catch(err => { console.error('探针异常:', err); process.exit(1); });
