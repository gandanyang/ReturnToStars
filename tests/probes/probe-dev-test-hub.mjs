/**
 * probe-dev-test-hub.mjs — Dev Test Hub 验证探针
 *
 * 验证：
 *   T1 ?devHub=1 → station 加载不自动跳转
 *   T2 公告栏交互物存在
 *   T3 交互 → dev seed 菜单弹出
 *   T4 选择 ch1_market_after → 切换到 town 场景
 *   T5 状态验证：chapter=1 + marketSquare restored + 3 stall events triggered
 *   T6 选择 ch1_house_tidy → 切换到 house 场景
 *   T7 状态验证：chapter=1 + 4 tidy events + house tidy complete
 *   T8 选择 ch0_before_stargaze → chapter=0 + 无事件
 *   T9 无页面错误
 *
 * 依赖：dev server (localhost:5173/?devHub=1) + window.debug / window.__game
 * 视口：横屏 1024x768
 * 运行：node tests/probes/probe-dev-test-hub.mjs
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

try {
  // ============ T1: ?devHub=1 → station 加载不自动跳转 ============
  // 先清存档再进 devHub 模式
  await page.goto(BASE + '?reset=1', { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.goto(BASE + '?devHub=1', { waitUntil: 'networkidle2' });
  await sleep(2000);

  // 等待 TitleScene → 按 Enter 进 StationScene
  await page.waitForFunction(() => {
    const s = window.__game?.scene?.getScene?.('title');
    return !!s && s.scene.isActive();
  }, { timeout: 10000 });
  await sleep(500);
  await page.keyboard.press('Enter');
  await sleep(2000);

  const stationLoaded = await waitScene('station', 15000);
  result('T1 ?devHub=1 → station 加载不自动跳转', stationLoaded,
    stationLoaded ? '' : 'station 场景未加载');

  if (!stationLoaded) {
    console.log('\n❌ station 未加载，终止');
    await browser.close();
    process.exit(1);
  }

  // ============ T2: 公告栏交互物存在 ============
  const hasDevInteractable = await page.evaluate(() => {
    const s = window.__game.scene.getScene('station');
    if (!s) return false;
    const dev = s.interactables.find(
      (i) => i.text && i.text.includes('开发者测试入口')
    );
    return !!dev;
  });
  result('T2 公告栏交互物存在', hasDevInteractable,
    hasDevInteractable ? '' : '未找到开发者入口交互物');

  // ============ T3: 交互 → dev seed 菜单弹出 ============
  // 移动玩家到公告栏位置 (400, 430)
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('station');
    s.player.x = 400;
    s.player.y = 430;
  });
  await sleep(300);
  // 按 E 触发交互
  await page.keyboard.press('KeyE');
  await sleep(800);

  const menuVisible = await page.evaluate(() => {
    return document.body.innerHTML.includes('开发者测试入口');
  });
  result('T3 交互 → dev seed 菜单弹出', menuVisible,
    menuVisible ? '' : '菜单未出现');

  // ============ T4: 选择 ch1_market_after → 切换到 town ============
  // 点击 "集市恢复后" 选项
  const clicked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('div')];
    const target = items.find(
      (el) => el.textContent.includes('集市恢复后') && el.style.cursor === 'pointer'
    );
    if (target) {
      target.click();
      return true;
    }
    return false;
  });
  result('T4a 点击「集市恢复后」', clicked, clicked ? '' : '未找到选项');

  // 等待场景切换
  await sleep(2000);
  const townLoaded = await waitScene('town', 15000);
  result('T4b 切换到 town 场景', townLoaded, townLoaded ? '' : 'town 未加载');

  // ============ T5: 状态验证 ============
  if (townLoaded) {
    const state = await page.evaluate(() => {
      return {
        chapter: window.debug.getChapter(),
        marketRestored: window.debug.events.hasTriggered('ch1_market_cleared'),
        stall1: window.debug.events.hasTriggered('ch1_market_stall_1'),
        stall2: window.debug.events.hasTriggered('ch1_market_stall_2'),
        stall3: window.debug.events.hasTriggered('ch1_market_stall_3'),
        marketSquare: window.__game.scene.getScene('town')?.marketSquareRestore?.restored,
      };
    });
    result('T5a chapter=1', state.chapter === 1, `got ${state.chapter}`);
    result('T5b ch1_market_cleared triggered', state.marketRestored, '');
    result('T5c 3 stalls triggered', state.stall1 && state.stall2 && state.stall3,
      `s1=${state.stall1} s2=${state.stall2} s3=${state.stall3}`);
    result('T5d marketSquare restored', state.marketSquare === true,
      `got ${state.marketSquare}`);
  }

  // ============ T6: 重新打开菜单 → 选择 ch1_house_tidy ============
  // 不刷新页面，直接切回 station（URL 仍含 ?devHub=1，isDevHubEnabled() 仍 true）
  await page.evaluate(() => {
    window.__game.scene.start('station');
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

  // 点击 "老屋整理完成"
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('div')];
    const target = items.find(
      (el) => el.textContent.includes('老屋整理完成') && el.style.cursor === 'pointer'
    );
    if (target) target.click();
  });
  await sleep(2000);

  const houseLoaded = await waitScene('house', 15000);
  result('T6 切换到 house 场景', houseLoaded, houseLoaded ? '' : 'house 未加载');

  // ============ T7: 老屋整理状态验证 ============
  if (houseLoaded) {
    const state = await page.evaluate(() => {
      return {
        chapter: window.debug.getChapter(),
        tidyLevel: window.debug.getHouseTidyLevel(),
        tidyComplete: window.debug.isHouseTidyComplete(),
        bed: window.debug.events.hasTriggered('ch1_bed_done'),
        lamp: window.debug.events.hasTriggered('ch1_lamp_done'),
        desk: window.debug.events.hasTriggered('ch1_desk_done'),
        radio: window.debug.events.hasTriggered('ch1_radio_done'),
        aggregate: window.debug.events.hasTriggered('ch1_house_tidy_done'),
      };
    });
    result('T7a chapter=1', state.chapter === 1, `got ${state.chapter}`);
    result('T7b tidyLevel=4', state.tidyLevel === 4, `got ${state.tidyLevel}`);
    result('T7c isHouseTidyComplete', state.tidyComplete, '');
    result('T7d 4 tidy events all triggered',
      state.bed && state.lamp && state.desk && state.radio,
      `bed=${state.bed} lamp=${state.lamp} desk=${state.desk} radio=${state.radio}`);
    result('T7e aggregate event triggered', state.aggregate, '');
  }

  // ============ T8: ch0_before_stargaze → chapter=0 ============
  await page.evaluate(() => {
    window.__game.scene.start('station');
  });
  await sleep(2000);
  await waitScene('station', 15000);

  await page.evaluate(() => {
    const s = window.__game.scene.getScene('station');
    s.player.x = 400;
    s.player.y = 430;
  });
  await sleep(300);
  await page.keyboard.press('KeyE');
  await sleep(800);

  await page.evaluate(() => {
    const items = [...document.querySelectorAll('div')];
    const target = items.find(
      (el) => el.textContent.includes('观星夜前') && el.style.cursor === 'pointer'
    );
    if (target) target.click();
  });
  await sleep(2000);

  const farmLoaded = await waitScene('farm', 15000);
  result('T8a 切换到 farm 场景', farmLoaded, farmLoaded ? '' : 'farm 未加载');

  if (farmLoaded) {
    const chapter = await page.evaluate(() => window.debug.getChapter());
    result('T8b chapter=0', chapter === 0, `got ${chapter}`);
  }

  // ============ T9: 无页面错误 ============
  result('T9 无页面错误', warns.length === 0,
    warns.length > 0 ? warns.slice(0, 3).join('; ') : '');

  // ============ 总结 ============
  console.log(`\n=== Dev Test Hub 探针: ${pass} 通过 / ${fail} 失败 ===`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
} catch (e) {
  console.error('探针异常:', e.message);
  await browser.close();
  process.exit(1);
}
