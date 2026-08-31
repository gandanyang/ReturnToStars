/**
 * A6 车站场景升级运行时验证探针（试玩-05 / 批A A6）
 *
 * 背景：StationScene 已落地车站升级四层内容（氛围层/设施层/细节层/交互层），
 *       但缺验收探针。本探针按批A卡片验收标准「开场30秒有乡村车站质感；探针同步」验证。
 *
 * 验证：
 *   1. 清档启动 → 标题 Enter → 进入车站场景（完整序章入口）
 *   2. 站台交互物共 12 个（原 7 + 新增 5：售货机/旧报纸/公共电话/站台时钟/旧行李箱）
 *   3. 新增 5 个交互物文本齐全
 *   4. 氛围层生效：晨雾粒子 15 个（drawStation 尾段粒子循环）
 *   5. 「跳过开场」可用：点击后 storyStep=station_move 且 canMove=true
 *   6. 截图存档供制作人目测确认车站质感
 *   7. 无运行时错误（pageerror / console.error / 非 favicon 404）
 *
 * 前置：dev server 在 localhost:5173；node tests/probes/probe-ch0-station-visual.mjs
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

async function run() {
  console.log('=== A6 车站场景升级运行时验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  const errors = [];
  const notFound = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() === 404) notFound.push(r.url()); });

  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  try {
    // 1. 首次加载（清档防御：确保无存档，StationScene 才会播完整开场并画出全量装饰）
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await page.evaluate(() => localStorage.removeItem('return_star_save'));
    await page.reload({ waitUntil: 'networkidle2' });

    // 2. 状态驱动等待：等 title 场景就绪（不猜时序）
    let scene = '';
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      scene = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (scene === 'title') break;
    }
    check('标题场景就绪', scene === 'title', `当前=${scene}`);

    // 3. 开始游戏 → 等待进入车站场景
    await page.keyboard.press('Enter');
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      scene = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (scene === 'station') break;
    }
    check('进入车站场景', scene === 'station', `当前=${scene}`);
    await sleep(1200); // 等 drawStation 全量绘制稳定

    // 4. 交互物数量：原 7 + 新增 5 = 12
    const interactCount = await page.evaluate(() =>
      window.__game?.scene.getScene('station')?.interactables?.length ?? -1);
    check('站台交互物 = 12（原 7 + 新增 5）', interactCount === 12, `实际=${interactCount}`);

    // 5. 新增 5 个交互物文本齐全
    const foundTexts = await page.evaluate(() => {
      const list = window.__game?.scene.getScene('station')?.interactables ?? [];
      return list.map(o => o.text);
    });
    const keys = ['自动售货机', '旧报纸', '公共电话', '站台上的时钟', '旧行李箱'];
    const missing = keys.filter(k => !foundTexts.some(t => t.includes(k)));
    check('新增交互物文本齐全（售货机/报纸/电话/时钟/行李箱）', missing.length === 0,
      missing.length ? `缺失=${missing.join('/')}` : '');

    // 6. 氛围层证据：晨雾粒子 15 个
    const mistLen = await page.evaluate(() =>
      window.__game?.scene.getScene('station')?.mistParticles?.length ?? -1);
    check('晨雾粒子层 = 15', mistLen === 15, `实际=${mistLen}`);

    // 7. 「跳过开场」按钮出现后点击（DOM 原生 click 最接近真实用户行为）
    let clicked = false;
    for (let i = 0; i < 20 && !clicked; i++) {
      clicked = await page.evaluate(() => {
        const btn = document.getElementById('intro-skip-btn');
        if (!btn) return false;
        btn.click();
        return true;
      });
      if (!clicked) await sleep(300);
    }
    check('跳过开场按钮可点', clicked);
    await sleep(800); // 等 skipIntro 的 fadeIn(300) 完成

    // 8. 跳过后进入可移动状态：storyStep=station_move 且 canMove=true
    const postSkip = await page.evaluate(() => ({
      step: window.debug?.getStoryStep?.() ?? '',
      canMove: window.__game?.scene.getScene('station')?.canMove ?? null,
    }));
    check('跳过后剧情推进 + 可移动', postSkip.step === 'station_move' && postSkip.canMove === true,
      `step=${postSkip.step} canMove=${postSkip.canMove}`);

    // 9. 截图（供制作人目测确认「乡村车站质感」）
    const shot = join(SHOT_DIR, 'station-a6-verification.png');
    await page.screenshot({ path: shot });
    console.log(`  📸 ${shot}`);

    // 10. 运行时错误检查（favicon 忽略，同森林探针口径）
    const realErrors = errors.filter(e =>
      !e.includes('favicon') && !e.startsWith('console: Failed to load resource'));
    const real404 = notFound.filter(u => !u.endsWith('favicon.ico'));
    check('车站场景无运行时错误', realErrors.length === 0 && real404.length === 0,
      [...realErrors, ...real404.map(u => '404: ' + u.replace(GAME_URL, ''))].join(' | ') || '');
  } catch (e) {
    console.log('❌ 探针异常:', e.message);
    fail++;
  } finally {
    await browser.close();
  }

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  if (fail > 0) process.exit(1);
}

run().catch(err => { console.error('探针异常:', err); process.exit(1); });
