/**
 * 移动端操作文案适配探针 v6
 *
 * 在 844×390 横屏触屏视口（Android 手机横屏形态）验证：
 *   1. TitleScene 开始提示 = "点按屏幕 开始游戏"
 *   2. 出发选项「现在就走吗？」选择后收尾
 *   3. 移动提示由 showMoveHint 的 DOM（station-move-hint，含摇杆/移动）提供
 *   4. 文案不含 "[W/A/S/D]"
 *
 * 注意：游戏仅支持横屏（竖屏会被 index.html 的 #rotate-hint 遮挡/失真），
 * 且 844≥800 时 isMobileLayout() 依赖 isTouchDevice() 的 UA 判定，
 * 故必须注入 Android UA 才能命中移动端分支（同 probe-mobile-ux.mjs 横屏用例）。
 *
 * 完整开场时序：标题 Enter → 车站（黑屏800ms → 列车声~3.5s → 淡入1.2s → 手机通知 → 对话）
 * 前置：dev server 在 localhost:5173；node probe-mobile-text.mjs
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/?reset=1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('=== 移动端操作文案适配验证 v6（横屏 844×390 + Android UA）===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  // 注入 Android UA：844≥800，isMobileLayout 需 isTouchDevice()（UA 判定）命中才能走移动分支
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () =>
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      configurable: true,
    });
  });

  let pass = 0;
  let fail = 0;
  const check = (name, ok) => {
    console.log(`${ok ? '✅' : '❌'} ${name}`);
    ok ? pass++ : fail++;
  };

  const dlgState = () =>
    page.evaluate(() => {
      const z500 = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '500');
      const p = z500 ? [...z500.querySelectorAll('p')].filter(x => x.textContent.trim().length > 0).map(x => x.textContent.trim()) : [];
      return { open: !!z500 && z500.style.display !== 'none', p };
    });

  const waitFor = async (fn, timeout = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = await fn();
      if (v) return v;
      await sleep(250);
    }
    return null;
  };

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(2500);

    // 1. Title 文案
    const titleText = await page.evaluate(() => {
      const scene = window.__game?.scene?.getScene('title');
      return scene?.startPrompt?.text ?? null;
    });
    check(`标题提示 = "点按屏幕 开始游戏"（实际: ${titleText}）`, titleText === '点按屏幕 开始游戏');

    // 2. 进入车站，等待完整开场
    await page.keyboard.press('Enter');
    console.log('  等待开场动画（列车声→淡入→手机通知）…');

    // 3. 点掉音量提示（zIndex 650，手机通知前的一步；@不放up提醒）
    const soundPromptClosed = await waitFor(async () => {
      return await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '650');
        if (el && el.textContent.includes('建议打开声音')) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
        return el ? false : false;
      });
    }, 25000);
    check('音量提示出现并点击', !!soundPromptClosed);

    // 4. 等待手机通知（zIndex 600）——两页翻页：点第 1 页翻页，再点第 2 页关闭（P0 修订批两页化）。
    //    以「车站对话打开」为终态，点击幂等（对话打开后 overlay 已移除，循环自动停止）。
    let phoneDone = false;
    for (let i = 0; i < 60 && !phoneDone; i++) {
      await page.evaluate(() => {
        const overlay = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '600' && d.textContent.includes('人事通知'));
        if (!overlay) return;
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await sleep(200);
      phoneDone = await page.evaluate(() => {
        const s = window.__game.scene.getScenes(true)[0];
        return s?.storyDialogue?.isOpen?.() ?? false;
      });
    }
    check('手机通知两页点击后对话开始', phoneDone);
    await sleep(400);

    // 4. 等待对话打开且有文本
    const opened = await waitFor(async () => {
      const s = await dlgState();
      return s.open && s.p.length > 0 ? s : null;
    });
    check('对话已打开', !!opened);
    if (opened) console.log(`  首句: "${opened.p[opened.p.length - 1]?.slice(0, 40)}"`);

    // 5. 推进对话直到出发选项出现（打字机/旁白行速度不定，不固定空格次数）
    let optSeen = false;
    for (let i = 0; i < 60 && !optSeen; i++) {
      optSeen = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('走'));
        return btns.length > 0;
      });
      if (optSeen) break;
      await page.keyboard.press('Space');
      await sleep(120);
    }

    // 6. 到达选项行（P0-3 出发前主动选择）——按数字 1 选择「现在就走吗？」
    const optionVisible = await waitFor(async () => {
      return await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('走'));
        return btns.length > 0;
      });
    }, 6000);
    check('出现出发选项（现在就走吗？）', !!optionVisible);
    await page.keyboard.press('1');
    await sleep(400);

    // 7. 选择后轻收尾 1 句；移动教学由 showMoveHint 的 DOM 提示承担（P0-3：不再在对白末行）
    for (let i = 0; i < 2; i++) { await page.keyboard.press('Space'); await sleep(160); }
    const finalState = await dlgState();
    const lastText = finalState.p.length ? finalState.p[finalState.p.length - 1] : null;
    console.log(`  选择后末句: "${lastText}"`);
    // 移动提示已从对白末行移除 → 改为验证动图 DOM 提示元素出现（含"摇杆/移动"）
    const moveHint = await waitFor(async () => {
      return await page.evaluate(() => {
        const el = document.getElementById('station-move-hint');
        return el && (el.textContent.includes('摇杆') || el.textContent.includes('移动')) ? el.textContent : null;
      });
    }, 6000);
    check('移动提示由 showMoveHint DOM 提供（含摇杆/移动）', !!moveHint);
    if (moveHint) console.log(`  DOM 提示: "${moveHint}"`);
    check('移动提示不含 WASD 键名', !!moveHint && !moveHint.includes('W/A/S/D'));
  } finally {
    await browser.close();
  }

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  if (fail > 0) process.exit(1);
}

run().catch(err => { console.error('探针异常:', err); process.exit(1); });
