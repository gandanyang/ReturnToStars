/**
 * 视觉探针 — 阿风/夏雅头像重出（v2/v4）游戏内显示截图
 * 前置：Vite dev server 运行在 localhost:5175
 * 用法：node tests/probes/probe-portrait-v2v4-visual.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:5175/';

mkdirSync(SCREENSHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const ok = (name, passed, detail = '') => {
  console.log(`${passed ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
  passed ? pass++ : fail++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('=== 视觉探针：阿风 v2 / 夏雅 v4 头像显示 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--window-size=1280,800'],
  });
  const page = await browser.newPage();

  // 加载游戏（横屏画布）
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  // 等待 game 就绪
  let ready = false;
  for (let i = 0; i < 20; i++) {
    ready = await page.evaluate(() => !!window.__game?.scene?.getScenes?.length);
    if (ready) break;
    await sleep(500);
  }
  ok('游戏实例就绪', ready);

  // 关闭可能的标题/教程 overlay 并进入 farm 场景
  await page.evaluate(() => {
    const g = window.__game;
    const active = g.scene.getScenes(true)[0];
    if (active && active.scene.key !== 'farm') {
      g.scene.stop(active.scene.key);
      g.scene.start('farm');
    }
  });
  await sleep(2500);

  // 用 StoryDialogue 播放测试对白（夏雅 + 阿风各一句）
  const playOk = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('farm');
    if (!s?.storyDialogue?.play) return false;
    s.storyDialogue.play([
      { speaker: '夏雅', color: '#e8a868', text: '以前爷爷总说，花开不重要。有人愿意等它开，才重要。' },
      { speaker: '阿风', color: '#88b8e8', text: '不看开怎么办？看不开也没人帮我开。' },
      { speaker: '林澈', color: '#7eb8da', text: '……你们俩，还真是一个岛的人。' },
    ]);
    return true;
  });
  ok('播放测试对白（夏雅→阿风→林澈）', playOk);

  await sleep(1200);

  // 截图：夏雅头像
  await page.screenshot({ path: join(SCREENSHOT_DIR, 'portrait-xiya-v4.png') });

  // 推进到阿风
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    if (s?.storyDialogue?.isOpen()) s.storyDialogue.advance();
  });
  await sleep(250);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    if (s?.storyDialogue?.isOpen()) s.storyDialogue.advance();
  });
  await sleep(1000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, 'portrait-afeng-v2.png') });

  // 校验实际加载的立绘 src
  const srcs = await page.evaluate(() => {
    const s = window.__game.scene.getScene('farm');
    const img = s?.storyDialogue?.portraitEl?.querySelector('img');
    return img ? img.getAttribute('src') : '<no-img>';
  });
  console.log(`  当前立绘 src: ${srcs}`);
  ok('对话头像已加载', srcs.includes('afeng_ai_v2.webp'), srcs);

  await browser.close();
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  console.log(`截图目录: ${SCREENSHOT_DIR}`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
