/**
 * probe-ch1-quest-panel.mjs — 第一章任务链接入任务面板主线页签验证
 *
 * 验证（Level 2）：
 *   T1 跳 ch0_before_stargaze（第0章）→ 主线页签无第一章任务链
 *   T2 跳 ch1_first_response（第一章起点）→ 主线页签出现第一章任务链
 *       整理老屋=进行中(0/4)、镇长来访🔒、集市🔒、春日集🔒
 *   T3 跳 ch1_house_tidy（老屋整理完成）→ 整理老屋✅、镇长来访=进行中
 *   T4 跳 ch1_market_after（集市开张）→ 老屋✅、镇长✅、集市✅、春日集=进行中
 *   T5 跳 ch1_spring_fair（春日集）→ 春日集✅
 *   T6 全程无页面错误
 *
 * 前置：dev server (localhost:5173/?devHub=1)
 * 视口：横屏 1024x768
 * 运行：node tests/probes/probe-ch1-quest-panel.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,
  defaultViewport: { width: 1024, height: 768 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0;
let fail = 0;
function result(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const warns = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') warns.push('[console.error] ' + msg.text());
});
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));

async function waitScene(key, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate((k) => {
      const s = window.__game?.scene?.getScene?.(k);
      return !!s && !!s.player;
    }, key);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}

/** 通过 Dev Hub 跳档到指定种子 */
async function jumpToSeed(seedLabel) {
  // 回 station（URL 仍含 ?devHub=1）
  await page.evaluate(() => {
    const g = window.__game;
    if (!g) return;
    try {
      const cur = g.scene.getScenes(true)[0];
      if (cur) g.scene.stop(cur.scene.key);
    } catch (e) { /* ignore */ }
    g.scene.start('station');
  });
  await sleep(2000);
  await waitScene('station', 15000);
  // 移动到公告栏 + 交互
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('station');
    s.player.x = 400;
    s.player.y = 430;
  });
  await sleep(300);
  await page.keyboard.press('KeyE');
  await sleep(800);
  await page.evaluate((label) => {
    const items = [...document.querySelectorAll('div')];
    const target = items.find(
      (el) => el.textContent.includes(label) && el.style.cursor === 'pointer'
    );
    if (target) target.click();
  }, seedLabel);
  await sleep(2500);
}

/** 打开任务面板主线页签，读取内容 */
async function readMainTab() {
  await page.evaluate(() => {
    const s = window.__game?.scene?.getScenes?.(true)[0];
    if (s && typeof s.questPanel?.open === 'function') {
      s.questPanel.open();
      document.querySelector('#quest-panel [data-tab="main"]')?.click();
    }
  });
  await sleep(500);
  return page.evaluate(() => {
    const body = document.getElementById('quest-panel')?.querySelector('#qp-body')?.textContent ?? '';
    return body;
  });
}

/** 关闭面板 */
async function closePanel() {
  await page.evaluate(() => {
    document.querySelector('#quest-panel [data-action="close"]')?.click();
  });
  await sleep(300);
}

try {
  // ============ 进入 Dev Hub ============
  await page.goto(BASE + '?reset=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await page.goto(BASE + '?devHub=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);

  await page.waitForFunction(() => {
    const s = window.__game?.scene?.getScene?.('title');
    return !!s && s.scene.isActive();
  }, { timeout: 10000 });
  await sleep(500);
  await page.keyboard.press('Enter');
  await sleep(2000);
  const stationLoaded = await waitScene('station', 15000);
  if (!stationLoaded) {
    console.log('\n❌ station 未加载，终止');
    await browser.close();
    process.exit(1);
  }

  // ============ T1: 第0章观星夜前 → 无第一章任务链 ============
  await jumpToSeed('观星夜前');
  await waitScene('farm', 15000);
  await sleep(500);
  let body = await readMainTab();
  result('T1a 第0章主线页签含星之碎片', body.includes('星之碎片'), '');
  result('T1b 第0章无第一章任务链', !body.includes('第一章'), `got=${body.slice(0, 60)}`);
  await closePanel();

  // ============ T2: 第一章起点 → 任务链出现，整理老屋进行中 ============
  await jumpToSeed('第一声回应');
  await waitScene('house', 15000);
  await sleep(500);
  body = await readMainTab();
  result('T2a 第一章主线页签出现任务链', body.includes('第一章'), '');
  result('T2b 整理老屋=进行中', body.includes('整理老屋') && body.includes('进行中'), '');
  result('T2c 整理进度 0/4', body.includes('0/4'), '');
  result('T2d 镇长来访锁定', body.includes('🔒 镇长来访'), '');
  result('T2e 集市锁定', body.includes('🔒 集市重新开张'), '');
  result('T2f 春日集锁定', body.includes('🔒 春日集'), '');
  await closePanel();

  // ============ T3: 老屋整理完成 → 整理✅ 镇长进行中 ============
  await jumpToSeed('老屋整理完成');
  await waitScene('house', 15000);
  await sleep(500);
  body = await readMainTab();
  result('T3a 整理老屋=已完成', body.includes('✅ 整理老屋'), '');
  result('T3b 镇长来访=进行中', body.includes('镇长来访') && body.includes('进行中'), '');
  result('T3c 集市仍锁定', body.includes('🔒 集市重新开张'), '');
  await closePanel();

  // ============ T4: 集市开张 → 集市✅ 春日集进行中 ============
  await jumpToSeed('集市恢复后');
  await waitScene('town', 15000);
  await sleep(500);
  body = await readMainTab();
  result('T4a 老屋=已完成', body.includes('✅ 整理老屋'), '');
  result('T4b 镇长=已完成', body.includes('✅ 镇长来访'), '');
  result('T4c 集市=已完成', body.includes('✅ 集市重新开张'), '');
  result('T4d 春日集=进行中', body.includes('春日集') && body.includes('进行中'), '');
  await closePanel();

  // ============ T5: 春日集 → 全部完成 ============
  await jumpToSeed('春日集');
  await waitScene('town', 15000);
  await sleep(500);
  body = await readMainTab();
  result('T5a 春日集=已完成', body.includes('✅ 春日集'), '');
  result('T5b 老屋/镇长/集市均完成',
    body.includes('✅ 整理老屋') && body.includes('✅ 镇长来访') && body.includes('✅ 集市重新开张'), '');
  await closePanel();

  // ============ T6: 无页面错误 ============
  result('T6 无页面错误', warns.length === 0,
    warns.length > 0 ? warns.slice(0, 3).join('; ') : '');

  console.log(`\n=== 第一章任务面板探针: ${pass} 通过 / ${fail} 失败 ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
} catch (e) {
  console.error('探针异常:', e.message);
  await browser.close();
  process.exit(1);
}
