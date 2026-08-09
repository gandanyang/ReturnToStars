/**
 * 灯塔视觉升级（2026-08-09）实机验证探针
 * （2026-08-10 制作人方向对齐后更新：灯塔=未来内容预埋，灯室恒熄灭）
 *
 * 验证（Level 2）：
 *   1. 白天（10:00）：塔身层次 Graphics 已挂载；灯室光晕 alpha=0（熄灭）；
 *      光束/星点不存在（null）
 *   2. 夜晚（21:00，scene.restart 重建）：灯室仍熄灭（alpha=0——"现在它是黑的"）；
 *      光束不存在（预埋禁用）；星点存在（夜空环境，非灯塔灯）
 *   3. 截图归档：白天全景/守塔人小屋残迹/夜晚全景 3 张
 *
 * 用法：dev server（npm run dev）；node tests/probes/probe-lighthouse-visual.mjs
 * 视口：横屏 1024×768（项目手机端只支持横屏，禁止竖屏视口——probe-farm-tap 教训）
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

mkdirSync(SHOT_DIR, { recursive: true });

const makeSave = () => JSON.stringify({
  version: '0.5', savedAt: 'lh-visual-probe', timestamp: Date.now(),
  player: { x: 240, y: 240, scene: 'lighthouse', facing: 'down', inventory: {} },
  world: { day: 2, hour: 10, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'done' },
  farm: { tiles: [], crops: [], trees: [], restore: { garden: true } },
  worldRestore: {},
  story: { storyStep: 'done' },
  mapFlags: {},
  gameState: { triggeredEvents: {} },
});

async function run() {
  console.log('=== 灯塔视觉升级（2026-08-09）实机验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let fails = 0;
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails++;
  };

  const lhState = () => page.evaluate(() => {
    const s = window.__game?.scene.getScene('lighthouse');
    if (!s) return null;
    return {
      roomAlpha: s.lhRoomGlow ? s.lhRoomGlow.alpha : -1,
      hasBeam: !!s.lhBeam,
      beamAlpha: s.lhBeam ? s.lhBeam.alpha : -1,
      hasStars: !!s.lhStars,
      starsAlpha: s.lhStars ? s.lhStars.alpha : -1,
    };
  });

  try {
    // 种子存档直达灯塔（白天 10:00）
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await page.evaluate((save) => localStorage.setItem('return_star_save', save), makeSave());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.evaluate(() => window.__game.scene.start('lighthouse', { spawn: { x: 240, y: 240 } }));
    await sleep(2500);

    // 1) 白天断言
    const day = await lhState();
    check('白天：塔身/灯室 Graphics 已挂载', day && day.roomAlpha >= 0, `roomAlpha=${day?.roomAlpha}`);
    check('白天：灯室熄灭 (alpha=0)', day && day.roomAlpha === 0, `alpha=${day?.roomAlpha?.toFixed(3)}`);
    check('白天：光束不存在', day && !day.hasBeam, 'lhBeam=null');
    check('白天：星点不存在', day && !day.hasStars, 'lhStars=null');
    await page.screenshot({ path: join(SHOT_DIR, 'lighthouse-visual-day.png') });
    console.log(`📸 ${join(SHOT_DIR, 'lighthouse-visual-day.png')}`);

    // 塔前近景（守塔人小屋残迹/生锈标牌/废弃工具视角）
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('lighthouse');
      s.player.setPosition(340, 224);
    });
    await sleep(1200);
    await page.screenshot({ path: join(SHOT_DIR, 'lighthouse-visual-ruin.png') });
    console.log(`📸 ${join(SHOT_DIR, 'lighthouse-visual-ruin.png')}`);

    // 2) 夜晚：置 21:00 并重启场景（create 时按夜晚重建视觉层）
    await page.evaluate(() => {
      window.debug.setTime(21, 0);
      const s = window.__game.scene.getScene('lighthouse');
      s.scene.restart();
    });
    await sleep(2500);
    const nightA = await lhState();
    check('夜晚：灯室仍熄灭 (alpha=0——未来内容预埋)', nightA && nightA.roomAlpha === 0, `alpha=${nightA?.roomAlpha?.toFixed(3)}`);
    check('夜晚：光束不存在（预埋禁用）', nightA && !nightA.hasBeam, 'lhBeam=null');
    check('夜晚：星点存在（夜空环境）', nightA && nightA.hasStars, `starsAlpha=${nightA?.starsAlpha?.toFixed(2)}`);
    await page.screenshot({ path: join(SHOT_DIR, 'lighthouse-visual-night.png') });
    console.log(`📸 ${join(SHOT_DIR, 'lighthouse-visual-night.png')}`);

    const realErrors = errors.filter(e => !e.includes('favicon'));
    check('无运行时错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

    console.log(`\n${fails === 0 ? '🎉 全部通过' : `⚠️ ${fails} 项失败`}`);
  } finally {
    await browser.close();
  }
  process.exit(fails === 0 ? 0 : 1);
}

run().catch(err => { console.error('探针异常:', err.message); process.exit(1); });
