/**
 * 诊断探针 2：运行时读取 house 场景真实状态（玩家坐标/houseTidy/候选解析结果）
 * 定位「首次 interact 直接触发床交互而未被 house_tidy 拦截」的原因
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

    await page.evaluate(() => {
      window.debug.setChapter(1);
      window.debug.setStoryStep('done');
      window.debug.setTimeFull(5, 12, 0);
      const g = window.__game;
      g.scene.start('house', { spawn: { x: 40, y: 72 } });
    });
    await sleep(2600);

    const state = await page.evaluate(() => {
      const s = window.__game.scene.getScene('house');
      if (!s) return { error: 'house scene not found' };
      const tidy = (s.houseTidy || []).map(it => ({
        key: it.key,
        pos: { x: it.pos?.x, y: it.pos?.y },
        hasMark: !!it.mark,
      }));
      const px = s.player?.x, py = s.player?.y;
      const tidyDist = tidy.map(it => {
        const dx = px - it.pos.x, dy = py - it.pos.y;
        return { key: it.key, dist: Math.round(Math.sqrt(dx * dx + dy * dy)), within48: dx * dx + dy * dy < 48 * 48 };
      });
      // P7b 候选解析：直接调私有方法（JS 运行时可访问）
      let resolved = null, candidateChecks = null;
      try {
        const cands = s.buildInteractionCandidates();
        candidateChecks = cands.slice(0, 6).map(c => {
          let ok = false, err = null;
          try { ok = c.check(); } catch (e) { err = String(e); }
          return { id: c.id, ok, err };
        });
        const t = s.interactionRouter.resolveTarget(cands);
        resolved = t ? t.id : null;
      } catch (e) { candidateChecks = 'router fail: ' + String(e); }
      return {
        player: { x: px, y: py },
        tidyCount: tidy.length,
        tidy,
        tidyDist,
        chapter: window.debug.getChapter(),
        resolved,
        candidateChecks,
      };
    });
    console.log(JSON.stringify(state, null, 1));
  } finally {
    await browser.close();
  }
}

run().catch(err => { console.error('诊断异常:', err); process.exit(1); });
