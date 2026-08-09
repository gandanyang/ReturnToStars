/**
 * 移动端 UX 修复验证（P0 背包按钮 + P2 跳过按钮隐藏）
 * 前置：dev server 在 localhost:5173；node probe-mobile-ux.mjs
 */

import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sceneInfo(page) {
  return page.evaluate(() => ({
    scene: window.__game.scene.getScenes(true)[0]?.scene?.key ?? 'none',
    step: window.debug?.getStoryStep?.(),
  }));
}

async function gotoScene(page, key, spawn) {
  await page.evaluate(([k, sp]) => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== k) g.scene.stop(active.scene.key);
    g.scene.start(k, sp ? { spawn: sp } : undefined);
  }, [key, spawn ?? null]);
  await sleep(2600);
}

async function run() {
  console.log('=== 移动端 UX 修复验证 ===\n');
  // 项目硬性规则：移动端只支持横屏（竖屏会被 #rotate-hint 全屏遮挡）。
  // 用 844×390 横屏触屏视口 + Android UA（isTouchDevice 按 UA 判定，见 config.ts）。
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });
  });
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);

    // ===== P2：车站跳过按钮在对话结束后隐藏 =====
    await page.keyboard.press('Enter');
    await sleep(2200);
    // 点掉音量提示（zIndex 650）→ 手机通知出现
    for (let i = 0; i < 30; i++) {
      const c = await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find(d => d.style.zIndex === '650' && d.textContent.includes('建议打开声音游玩'));
        if (el) { el.click(); return true; }
        return false;
      });
      if (c) break;
      await sleep(300);
    }
    await sleep(400);
    // 等待手机通知 → 两页点击（第 1 页翻页 → 第 2 页关闭）→ 对白开始（P0 修订批两页化）
    let opened = false;
    for (let i = 0; i < 80 && !opened; i++) {
      await page.evaluate(() => {
        const p1 = [...document.querySelectorAll('div')].find(d =>
          d.textContent?.includes('人事通知') && d.textContent?.includes('岗位职责'));
        if (p1 && p1.style.opacity !== '0') { p1.click(); return; }
        const p2 = [...document.querySelectorAll('div')].find(d =>
          d.textContent?.includes('职业转换支持计划') && d.textContent?.includes('点击关闭'));
        if (p2 && p2.style.opacity !== '0') p2.click();
      });
      opened = await page.evaluate(() => {
        const s = window.__game.scene.getScenes(true)[0];
        return s?.storyDialogue?.isOpen?.() ?? false;
      });
      if (!opened) await sleep(250);
    }
    console.log(`P2a. 车站对白打开: ${opened ? '✅' : '❌'}`);
    check('P2a. 车站对白打开', opened);
    const skipVisibleWhileOpen = await page.evaluate(() => !!document.getElementById('intro-skip-btn'));
    check('P2b. 对白期间跳过按钮存在（预期存在）', skipVisibleWhileOpen);
    // 推进对白直到结束：选项行出现时选「现在就走吗？」，其余行 advance（P0 修订批独白为 10 行含选项行）
    let dlgDone = false;
    for (let i = 0; i < 60 && !dlgDone; i++) {
      const state = await page.evaluate(() => {
        const s = window.__game.scene.getScenes(true)[0];
        if (!s?.storyDialogue?.isOpen?.()) return 'closed';
        const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('走'));
        if (btns.length > 0) { btns[0].click(); return 'option'; }
        s.storyDialogue.advance();
        return 'adv';
      });
      if (state === 'closed') { dlgDone = true; break; }
      if (state === 'option') await sleep(200);
      await sleep(40);
    }
    await sleep(600);
    const skipGone = await page.evaluate(() => !document.getElementById('intro-skip-btn'));
    const dlgClosed = await page.evaluate(() => {
      const s = window.__game.scene.getScenes(true)[0];
      return !(s?.storyDialogue?.isOpen?.());
    });
    check('P2c. 对白结束后跳过按钮已隐藏', skipGone && dlgClosed);

    // ===== P0：移动端背包按钮 =====
    await page.evaluate(() => {
      window.debug.setStoryStep('done');
      window.debug.setTime(14, 0);
    });
    await gotoScene(page, 'farm', { x: 400, y: 300 });
    const bpBtn = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#touch-controls div')];
      const b = btns.find(x => x.textContent?.trim() === '背包');
      return b ? { exists: true, display: b.style.display } : { exists: false, display: '' };
    });
    check('P0a. 移动端背包按钮存在且可见', bpBtn.exists && bpBtn.display === 'flex', JSON.stringify(bpBtn));

    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#touch-controls div')];
      const b = btns.find(x => x.textContent?.trim() === '背包');
      if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    await sleep(400);
    const bpOpen = await page.evaluate(() => {
      const el = document.getElementById('backpack-panel');
      return { exists: !!el, display: el?.style.display ?? '' };
    });
    console.log(`P0b. 点击背包按钮 → 背包面板打开: ${bpOpen.exists && bpOpen.display === 'flex' ? '✅' : '❌'} ${JSON.stringify(bpOpen)}`);
    await page.evaluate(() => {
      document.querySelector('#backpack-panel [data-action="close"]')?.click();
    });
    await sleep(300);
    const bpClosed = await page.evaluate(() => {
      const el = document.getElementById('backpack-panel');
      return el?.style.display ?? '';
    });
    check('P0c. 关闭背包', bpClosed === 'none', `display=${bpClosed}`);

    // ===== 提示文案移动端适配 =====
    await page.evaluate(() => window.debug.setStoryStep('get_key'));
    await gotoScene(page, 'gate', { x: 200, y: 200 });
    const hint = await page.evaluate(() => {
      const els = [...document.querySelectorAll('div')];
      const h = els.find(x => x.textContent?.includes('「背包」按钮'));
      return h?.textContent ?? '';
    });
    check('P1h. 移动端提示含「背包」按钮指引', hint.includes('「背包」按钮'), hint.substring(0, 40));

    // 桌面端对比：背包按钮应隐藏（独立桌面实例；本移动实例已注入 Android UA，无法同页切回桌面）
    const bDesk = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,
      defaultViewport: { width: 1024, height: 768 },
      args: ['--no-sandbox'],
    });
    const pDesk = await bDesk.newPage();
    await pDesk.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(2500);
    await pDesk.evaluate(() => {
      const g = window.__game;
      window.debug.setStoryStep('done');
      const active = g.scene.getScenes(true)[0];
      if (active && active.scene.key !== 'farm') g.scene.stop(active.scene.key);
      g.scene.start('farm', { spawn: { x: 400, y: 300 } });
    });
    await sleep(3000);
    const bpDesktop = await pDesk.evaluate(() => {
      const btns = [...document.querySelectorAll('#touch-controls div')];
      const b = btns.find(x => x.textContent?.trim() === '背包');
      return b ? b.style.display : 'none';
    });
    check('P1d. 桌面端背包按钮隐藏', bpDesktop === 'none', `display=${bpDesktop}`);
    await bDesk.close();

    // 横屏手机（宽度 ≥800）：背包按钮应仍可见（本次 bug 场景）
    // 用启动即横屏触屏视口的新实例（等价真机加载，避免运行时触屏模拟时序问题）
    const bLand = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,
      defaultViewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
      args: ['--no-sandbox'],
    });
    const pLand = await bLand.newPage();
    // 真机 Android 横屏：覆盖 UA 为移动端（isTouchDevice 按 UA 判定，见 config.ts）
    await pLand.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
        configurable: true,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });
    });
    await pLand.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(2500);
    // 进入农场场景（TouchControls 在 MapScene create 时创建）
    await pLand.evaluate(() => {
      const g = window.__game;
      window.debug.setStoryStep('done');
      const active = g.scene.getScenes(true)[0];
      if (active && active.scene.key !== 'farm') g.scene.stop(active.scene.key);
      g.scene.start('farm', { spawn: { x: 400, y: 300 } });
    });
    await sleep(3000);
    const touchInfo = await pLand.evaluate(() => ({
      maxTouchPoints: navigator.maxTouchPoints,
      ontouchstart: 'ontouchstart' in window,
    }));
    const bpLandscape = await pLand.evaluate(() => {
      const btns = [...document.querySelectorAll('#touch-controls div')];
      const b = btns.find(x => x.textContent?.trim() === '背包');
      return b ? b.style.display : 'none';
    });
    console.log(`P0e-debug touch: ${JSON.stringify(touchInfo)}`);
    check('P0e. 横屏(844×390)背包按钮可见', bpLandscape === 'flex', `display=${bpLandscape}`);
    await bLand.close();
  } finally {
    await browser.close();
  }

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  if (fail > 0) process.exit(1);
}

run().catch(err => { console.error('探针异常:', err); process.exit(1); });
