/**
 * 80分灵感① 第一株作物纪念探针（2026-08-09 制作人拍板）
 *
 * 需求：玩家第一次播种 → 归星录·相簿解锁《第一株新生命》（普通行为被赋予意义）。
 *
 * 验证：
 *   1. 播种前：first_crop 未解锁
 *   2. 第一次播种：解锁 + toast「📖 归星录新增照片《第一株新生命》」出现
 *   3. 相簿卡片：data-id="first_crop" 解锁态，img naturalWidth>0（图片加载成功，无破图）
 *   4. 存档持久化：localStorage album 含 first_crop
 *   5. 刷新重进：仍解锁（幂等 + 入档），重复播种不重复 toast
 *
 * 前置：dev server（5173/5174）；node tests/probes/probe-first-crop.mjs
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

const baseSave = {
  version: '0.5', savedAt: 'first-crop探针', timestamp: Date.now(),
  player: { x: 240, y: 96, scene: 'farm', facing: 'down', inventory: { old_hoe: 1, radish_seed: 5 } },
  world: { day: 1, hour: 9, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' },
};

async function run() {
  console.log('=== 第一株作物纪念（first_crop 相簿）验证 ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1024, height: 768 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() === 404) errors.push('404: ' + r.url()); });

  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
    ok ? pass++ : fail++;
  };

  const enterFarm = async () => {
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.evaluate((sv) => localStorage.setItem('return_star_save', JSON.stringify(sv)), baseSave);
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1000);
    let scene = '';
    for (let i = 0; i < 50; i++) {
      await sleep(300);
      scene = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (scene === 'farm') break;
      if (scene === 'title') {
        await page.keyboard.press('Enter');
        await page.mouse.click(400, 300);
      }
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find(d => d.textContent?.includes('建议打开声音游玩'));
        if (el) { el.click(); return true; }
        return false;
      });
    }
    if (scene !== 'farm') throw new Error('未能进入农场场景');
    await sleep(1500);
  };

  try {
    // 1. 进农场（未播种）
    await enterFarm();
    let locked = await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      return { firstPlant: s.firstPlant, album: JSON.parse(localStorage.getItem('return_star_save')).album ?? null };
    });
    check('初始 firstPlant=false（未播种）', locked.firstPlant === false, `实际=${locked.firstPlant}`);
    check('初始相簿无 first_crop', !locked.album || !locked.album.includes('first_crop'), `实际=${JSON.stringify(locked.album)}`);

    // 2. 第一次播种（选农田格 (15,10)：FARM_AREA 内，避开树/出口）
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      s.tillTileAt(15, 10);
      s.plantTileAt(15, 10, 'radish');
    });
    await sleep(900);
    const toastShown = await page.evaluate(() => {
      const els = [...document.querySelectorAll('div')].map(d => d.textContent ?? '');
      return els.some(t => t.includes('归星录新增照片') && t.includes('第一株新生命'));
    });
    const unlockedNow = await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      return s.firstPlant === true;
    });
    check('播种后 firstPlant=true', unlockedNow === true, `实际=${unlockedNow}`);
    check('toast 出现「📖 归星录新增照片《第一株新生命》」', toastShown === true, `实际=${toastShown}`);

    // 3. 打开相簿 → first_crop 卡片解锁 + 图片加载成功
    await page.evaluate(() => window.__game.scene.getScene('farm').openPhotoAlbum());
    await sleep(700);
    const card = await page.evaluate(() => {
      const el = document.querySelector('[data-id="first_crop"]');
      if (!el) return null;
      const img = el.querySelector('img[data-photo-img]');
      return {
        unlocked: el.getAttribute('data-unlocked') === '1',
        title: el.textContent?.includes('第一株新生命') ?? false,
        imgOk: !!img && img.complete && img.naturalWidth > 0,
        imgSrc: img ? img.getAttribute('src') : null,
      };
    });
    check('相簿 first_crop 卡片为解锁态', card && card.unlocked === true, `实际=${JSON.stringify(card)}`);
    check('卡片标题《第一株新生命》', card && card.title === true, `实际=${card?.title}`);
    check('照片图片加载成功（无破图）', card && card.imgOk === true, `实际=${card?.imgOk} src=${card?.imgSrc}`);
    try {
      await page.screenshot({ path: join(SHOT_DIR, 'first-crop-album.png') });
      console.log('  📸 first-crop-album.png');
    } catch { /* ignore */ }
    await page.evaluate(() => window.__game.scene.getScene('farm').photoAlbumPanel?.close());
    await sleep(300);

    // 4. 存档持久化
    const saved = await page.evaluate(() => {
      const sv = JSON.parse(localStorage.getItem('return_star_save'));
      return sv.album ?? null;
    });
    check('存档 album 含 first_crop（持久化）', !!saved && saved.includes('first_crop'), `实际=${JSON.stringify(saved)}`);

    // 5. 刷新重进：仍解锁，重复播种不再解锁/不 toast
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1000);
    let scene = '';
    for (let i = 0; i < 50; i++) {
      await sleep(300);
      scene = await page.evaluate(() => window.__game?.scene.getScenes(true)[0]?.scene?.key ?? 'none');
      if (scene === 'farm') break;
      if (scene === 'title') { await page.keyboard.press('Enter'); await page.mouse.click(400, 300); }
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find(d => d.textContent?.includes('建议打开声音游玩'));
        if (el) { el.click(); return true; }
        return false;
      });
    }
    await sleep(1500);
    const relocked = await page.evaluate(() => {
      const s = window.__game.scene.getScene('farm');
      // 第二次播种（另一格）不应再解锁/toast
      s.tillTileAt(16, 10);
      s.plantTileAt(16, 10, 'radish');
      return true;
    });
    await sleep(900);
    // 刷新后需先打开相簿（面板懒创建，不 open 则 DOM 不存在）
    await page.evaluate(() => window.__game.scene.getScene('farm').openPhotoAlbum());
    await sleep(700);
    const after = await page.evaluate(() => {
      const els = [...document.querySelectorAll('div')].map(d => d.textContent ?? '');
      const hasToast = els.some(t => t.includes('归星录新增照片') && t.includes('第一株新生命'));
      const el = document.querySelector('[data-id="first_crop"]');
      const img = el?.querySelector('img[data-photo-img]');
      return {
        toastAgain: hasToast,
        unlocked: el ? el.getAttribute('data-unlocked') === '1' : false,
        imgOk: !!img && img.complete && img.naturalWidth > 0,
      };
    });
    check('刷新重进后仍解锁', after.unlocked === true, `实际=${after.unlocked}`);
    check('重复播种不重复弹 toast（幂等）', after.toastAgain === false, `实际=${after.toastAgain}`);
    check('照片图片重进后仍加载成功', after.imgOk === true, `实际=${after.imgOk}`);

    // 6. 无运行时错误 / 无 404（图片资源存在）
    check('无 pageerror / console.error / 404', errors.length === 0, `实际=${errors.slice(0, 3).join(' | ')}`);
  } catch (e) {
    console.log('❌ 探针异常: ' + e.message);
    fail++;
  }

  await browser.close();
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
