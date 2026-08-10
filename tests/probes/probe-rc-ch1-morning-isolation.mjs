import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
  results.push({ name, ok, detail });
};

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: false,
    defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const enterGame = async (scene, timeoutMs = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const cur = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (cur === scene) return;
      if (cur === 'title') { await page.keyboard.press('Enter'); await page.mouse.click(400, 300); }
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find((d) => d.textContent?.includes('建议打开声音游玩'));
        if (el) { el.click(); return true; }
        return false;
      });
      await sleep(350);
    }
    throw new Error('未能进入场景 ' + scene);
  };

  const gotoState = async (day, hour) => {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page.evaluate(({ day, hour }) => {
      localStorage.setItem('return_star_save', JSON.stringify({
        version: '0.5', savedAt: 'probe-stargaze-isolation', timestamp: Date.now(),
        player: { x: 480, y: 300, scene: 'farm', facing: 'up', inventory: {} },
        world: { day, hour, minute: 0, coins: 200, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
        farm: { tiles: [], crops: [], trees: [] },
        story: { storyStep: 'done' },
      }));
    }, { day, hour });
    await page.reload({ waitUntil: 'networkidle2' });
    await enterGame('farm');
    await sleep(1500);
  };

  const snap = () => page.evaluate(() => {
    const s = window.__game?.scene?.getScene('farm');
    if (!s) return { loaded: false };
    const save = JSON.parse(localStorage.getItem('return_star_save') || 'null');
    const ev = save && save.gameState && save.gameState.triggeredEvents;
    return {
      loaded: true,
      dialogueOpen: !!(s.storyDialogue && s.storyDialogue.isOpen()),
      dialogueLines: s.storyDialogue ? (s.storyDialogue.lines || []).map((l) => l.text) : [],
      inStargaze: !!s.inStargazeCutscene,
      firstMorningEv: !!(ev && ev.first_morning_response),
      stargazeMark: !!(s.stargazeMark && s.stargazeMark.visible),
    };
  });

  try {
    // Case 1: day1 21:00（观星夜正常场景）进 farm → B1 不应触发，观星点应可见
    await gotoState(1, 21);
    let d = await snap();
    check('C1 day1 21:00 进 farm，观星点可见', d.stargazeMark === true, `mark=${d.stargazeMark}`);
    check('C2 day1 21:00 不触发清晨 B1 对白', d.dialogueOpen === false, `open=${d.dialogueOpen}`);
    check('C3 day1 21:00 B1 事件未写档', d.firstMorningEv === false, `ev=${d.firstMorningEv}`);
    check('C4 day1 21:00 未进入观星演出', d.inStargaze === false, `inStargaze=${d.inStargaze}`);
    await sleep(4500);
    d = await snap();
    check('C5 等待 4.5s 后 B1 仍不触发（day1 清晨条件不满足）', d.firstMorningEv === false && d.dialogueOpen === false,
      `ev=${d.firstMorningEv} open=${d.dialogueOpen}`);

    // Case 2: day2 21:00（观星夜后的自由模式）→ B1 不触发（已走完，observatory_complete）
    await gotoState(2, 21);
    d = await snap();
    check('C6 day2 21:00 不触发清晨 B1（时段不对）', d.dialogueOpen === false, `open=${d.dialogueOpen}`);

    const realErrors = errors.filter((e) => !e.includes('favicon') && !e.startsWith('console: Failed to load resource'));
    check('D1 无运行时错误', realErrors.length === 0, realErrors.join(' | ') || '');
  } finally {
    await browser.close();
  }
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n结果: ${pass} 通过 / ${results.length - pass} 失败`);
  if (results.some((r) => !r.ok)) process.exit(1);
}

run().catch((e) => { console.error('探针异常:', e); process.exit(1); });
