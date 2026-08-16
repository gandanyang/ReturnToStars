/**
 * _diag-dev-rain-residue.mjs — 复现制作者路径：
 *   ?devHub=1 → 车站公告栏 → 选「Day2 教学雨」→ 切 farm → 扫描残留的「按 [E]」节点
 * 目的：确认为什么「按 [E] 查看」从 dev 教学雨入口进入后一直不消失。
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/?devHub=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

async function moveTo(x, y) {
  await page.evaluate(([xx, yy]) => {
    const s = window.__game.scene.getScenes(true).find((e) => e && e.player && typeof e.player.x === 'number');
    if (s) { s.player.x = xx; s.player.y = yy; }
  }, [x, y]);
  await sleep(350);
}

/** 扫描所有"按 [E]"-类提示节点（固定定位 + 含 按[E]/点击「交互」 文本），
 *  返回 文本 + class + bottom 值，以及全部 body 里的按键提示文本（不限定位） */
async function scanHints(label) {
  const r = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div'));
    const anchors = all
      .filter((d) => d.style.position === 'fixed' && /按\s*\[E\]|点击「交互」/.test(d.textContent || ''))
      .map((d) => ({
        text: (d.textContent || '').trim().slice(0, 30),
        cls: d.className || '',
        bottom: d.style.bottom,
      }));
    const anyKey = all
      .filter((d) => /按\s*\[E\]/.test(d.textContent || ''))
      .map((d) => (d.textContent || '').trim().slice(0, 30));
    return { anchors, anyKey: [...new Set(anyKey)] };
  });
  console.log(`[${label}] anchors=`, JSON.stringify(r.anchors));
  if (r.anyKey.length) console.log(`[${label}] 任意包含"按 [E]"的div文本=`, JSON.stringify(r.anyKey));
  await page.screenshot({ path: (label.replace(/\W+/g, '_')) + '.png' });
  return r;
}

try {
  console.log('═══ 启动 ?devHub=1 ═══');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(3000);
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(3000);

  // 从 title 按 Enter 进入车站
  for (let i = 0; i < 6; i++) {
    const keys = await page.evaluate(() => window.__game.scene.getScenes(true).map((e) => e.scene.key));
    if (keys.includes('station')) break;
    await page.keyboard.press('Enter');
    await sleep(1200);
  }

  const sc = await page.evaluate(() => window.__game.scene.getScenes(true).map((e) => e.scene.key));
  console.log('scenes:', JSON.stringify(sc));

  // 车站公告栏在 (400,430)。移到公告栏旁，让「按 [E] 查看」显示
  await moveTo(400, 448);
  await sleep(600);
  await scanHints('公告栏旁(station)');

  // 不经过菜单点击（consumeAction 时序不稳），直接在提示显示态下切到 farm，
  // 验证 station 提示是否随 scene.start 残留（模拟"点教学雨种子进入 farm"）
  await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true).find((e) => e && e.scene && e.scene.key === 'station' && e.player);
    if (s) s.scene.start('farm', { spawn: { x: 240, y: 96 } });
  });
  await sleep(3500); // 切到 farm + 稳定
  console.log('scenes-after:', JSON.stringify(await page.evaluate(() => window.__game.scene.getScenes(true).map((e) => e.scene.key))));

  await scanHints('切到farm后');
  await sleep(1500);
  await scanHints('切到farm后(再等)');

  console.log('ERRORS', JSON.stringify(errors));
} finally {
  await browser.close();
}
process.exit(0);
