/**
 * 浏览器管理 — 统一 Puppeteer 启动/关闭，复用 Chrome 路径与标准配置。
 * 所有 v2 测试通过 harness.launch() 获取 browser+page，确保行为一致。
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';

/**
 * 启动浏览器并打开游戏页面。
 * @param {{ viewport?: object, mobile?: boolean }} opts
 *   - viewport: 自定义视口尺寸（默认 1024×768 桌面）
 *   - mobile: true 时使用横屏移动端视口（844×390 + Android UA）
 * @returns {Promise<{ browser: Browser, page: Page }>}
 */
export async function launch(opts = {}) {
  const { viewport, mobile = false } = opts;

  const vp = viewport ?? (mobile
    ? { width: 844, height: 390, isMobile: true, hasTouch: true }
    : { width: 1024, height: 768 });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: vp,
    args: ['--no-sandbox', ...(mobile ? [] : ['--start-maximized'])],
  });

  const page = await browser.newPage();

  if (mobile) {
    // 注入 Android UA（isTouchDevice 按 UA 判定，见 config.ts）
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    });
  }

  // 收集 console error 供测试检查
  page._consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') page._consoleErrors.push(msg.text());
  });

  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await waitForGame(page);

  return { browser, page };
}

/** 等待游戏就绪（window.__game + scene 可用） */
export async function waitForGame(page, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() =>
      typeof window.__game !== 'undefined' &&
      typeof window.debug !== 'undefined' &&
      window.__game.scene.getScenes(true).length > 0
    );
    if (ready) return;
    await sleep(200);
  }
  throw new Error(`Game not ready within ${timeoutMs}ms`);
}

/** 关闭浏览器（安全，忽略已关闭错误） */
export async function close(browser) {
  try { await browser.close(); } catch {}
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export { GAME_URL };
