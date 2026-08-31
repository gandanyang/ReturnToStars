/**
 * 诊断探针：验证 chapter 门禁/存档结构/对话时序（probe-sleep-freemode 校准用）
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 375, height: 812, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  try {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2500);
    await page.keyboard.press('Enter');
    await sleep(2200);
    await page.evaluate(() => {
      const btn = document.getElementById('intro-skip-btn');
      if (btn) btn.click();
    });
    await sleep(500);

    // 1. setChapter(1) 前后 chapter 值
    const ch0 = await page.evaluate(() => window.debug.getChapter());
    await page.evaluate(() => window.debug.setChapter(1));
    await sleep(200);
    const ch1 = await page.evaluate(() => window.debug.getChapter());

    // 2. 进 house 后 chapter 是否保持 + houseTidy 是否建立
    await page.evaluate(() => {
      window.debug.setStoryStep('done');
      window.debug.setTimeFull(5, 12, 0);
      const g = window.__game;
      g.scene.start('house', { spawn: { x: 40, y: 72 } });
    });
    await sleep(2600);
    const houseState = await page.evaluate(() => ({
      chapter: window.debug.getChapter(),
      step: window.debug.getStoryStep(),
      time: window.debug.getTimeStr(),
      tidyLevel: window.debug.getHouseTidyLevel?.(),
      tidyComplete: window.debug.isHouseTidyComplete?.(),
      bedDone: window.debug.events.hasTriggered('ch1_bed_done'),
    }));
    console.log('chapter 前后:', ch0, '→', ch1);
    console.log('house 状态:', JSON.stringify(houseState));

    // 3. 首次 interact（预期 house_tidy 叠被子拦截）
    await page.evaluate(() => {
      const b = document.querySelector('#touch-controls [data-action="interact"]');
      if (b) b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    await sleep(900);
    const after1 = await page.evaluate(() => ({
      bedDone: window.debug.events.hasTriggered('ch1_bed_done'),
      time: window.debug.getTimeStr(),
      dialogueOpen: [...document.querySelectorAll('p')].map(p => p.textContent).filter(t => t && t.length > 4).slice(0, 3),
    }));
    console.log('首次 interact 后:', JSON.stringify(after1));

    // 4. 存档结构 dump（顶层 key + world 部分）
    const saveStruct = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('return_star_save');
        if (!raw) return { exists: false };
        const data = JSON.parse(raw);
        const out = { exists: true, topKeys: Object.keys(data) };
        for (const k of Object.keys(data)) {
          if (data[k] && typeof data[k] === 'object' && 'day' in data[k]) out.dayIn = k;
        }
        return out;
      } catch (e) { return { error: String(e) }; }
    });
    console.log('存档结构:', JSON.stringify(saveStruct));

    // 5. 存一次档再看（触发 save 的动作：再 interact 一次或 debug.markRestored）
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('house');
      const p = s?.player;
      if (p && window.debug) {
        // 走 debug 存档路径
        const evt = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        const b = document.querySelector('#touch-controls [data-action="interact"]');
        if (b) b.dispatchEvent(evt);
      }
    });
    await sleep(1200);
    const saveStruct2 = await page.evaluate(() => {
      const raw = localStorage.getItem('return_star_save');
      if (!raw) return { exists: false };
      const data = JSON.parse(raw);
      return { exists: true, day: data?.world?.day ?? data?.day ?? JSON.stringify(data).slice(0, 200) };
    });
    console.log('再次 interact 后存档 day:', JSON.stringify(saveStruct2));
  } finally {
    await browser.close();
  }
}

run().catch(err => { console.error('诊断异常:', err); process.exit(1); });
