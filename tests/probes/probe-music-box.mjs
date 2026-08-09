/**
 * probe-music-box.mjs — P1 家的音乐盒（老屋 OST 收藏）验证探针
 *
 * 验证：
 * T1 老屋 house 场景有音乐盒交互物（musicBoxMark）
 * T2 靠近音乐盒按 E → 打开曲目面板（DOM 可见 + isOpen）
 * T3 面板曲目列表渲染（7 首：中文名/英文名/描述）
 * T4 点击曲目 → MusicSystem.current() 切换为该曲（等解码完成）
 * T5 切歌 → current 更新（点另一首）
 * T5b 播放状态变更后「正在播放」徽标实时刷新到当前曲目卡片
 * T6 关闭面板 → 音乐继续（current 不变）
 * T7 「停止播放」→ 恢复老屋日常 BGM（白天 farm_day）
 * 附加 无 [MusicSystem] 加载失败 / 页面错误
 *
 * 依赖：dev server (localhost:5173) + window.debug.musicCurrent
 * 视口：横屏 1024x768（项目红线：禁止竖屏视口）
 * 时序策略：Vite 懒加载首编慢 → 全部轮询等待，不用固定 sleep 断言
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
  if (msg.text().includes('[MusicSystem] 加载失败')) warns.push(msg.text());
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

async function waitMusic(expect, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const cur = await page.evaluate(() => window.debug.musicCurrent?.() ?? null);
    if (cur === expect) return cur;
    await sleep(250);
  }
  return await page.evaluate(() => window.debug.musicCurrent?.() ?? null);
}

async function waitPanel(expectOpen, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const vis = await page.evaluate(() => {
      const el = document.getElementById('music-box-panel');
      return !!el && el.style.display !== 'none' && el.style.opacity !== '0';
    });
    if (vis === expectOpen) return vis;
    await sleep(200);
  }
  return await page.evaluate(() => {
    const el = document.getElementById('music-box-panel');
    return !!el && el.style.display !== 'none' && el.style.opacity !== '0';
  });
}

async function waitBadge(key, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const has = await page.evaluate((k) => {
      const card = document.querySelector(`[data-action="play"][data-key="${k}"]`);
      return !!card && card.textContent.includes('正在播放');
    }, key);
    if (has) return has;
    await sleep(200);
  }
  return false;
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => {
    const b = document.getElementById('intro-skip-btn');
    if (b) b.click();
  });
  await sleep(500);

  await page.evaluate(() => {
    window.debug.setStoryStep('done');
    window.debug.setTime(10, 0);
    window.__game.scene.start('house', { spawn: { x: 160, y: 192 } });
  });
  const hok = await waitScene('house');
  result('T1 老屋场景就绪', hok, 'scene=house');

  const boxOk = await page.evaluate(() => !!window.__game?.scene?.getScene?.('house')?.musicBoxMark);
  result('T2a 老屋有音乐盒交互物', boxOk, 'musicBoxMark');
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    if (s.musicBoxMark) { s.player.x = s.musicBoxMark.x + 4; s.player.y = s.musicBoxMark.y + 16; }
    s.player.facing = 'up';
  });
  await sleep(400);
  const r2 = await page.evaluate(() => window.__game.scene.getScene('house').tryMusicBoxInteract());
  const vis2 = await waitPanel(true);
  result('T2 靠近音乐盒打开面板', r2 === true && vis2, `ret=${r2} visible=${vis2}`);
  await page.screenshot({ path: 'tests/probes/test-screenshots/music-box-panel.png' });

  const listInfo = await page.evaluate(() => {
    const el = document.getElementById('mb-list');
    if (!el) return null;
    const cards = [...el.querySelectorAll('[data-action="play"]')];
    const first = cards[0]?.textContent ?? '';
    return { count: cards.length, firstHasCn: /归来与新生之岛/.test(first), firstHasEn: /When The Island Wakes/.test(first), hasSpring: [...cards].some((c) => c.textContent.includes('春深有信')) };
  });
  result('T3 曲目列表 7 首含中文名/英文名', !!listInfo && listInfo.count === 7 && listInfo.firstHasCn && listInfo.firstHasEn && listInfo.hasSpring, JSON.stringify(listInfo));

  await page.evaluate(() => {
    const btn = document.querySelector('#music-box-panel [data-action="play"][data-key="title"]');
    btn?.click();
  });
  const cur4 = await waitMusic('title');
  result('T4 点击《归来与新生之岛》→ 播放', cur4 === 'title', cur4);
  const badge4 = await waitBadge('title');
  result('T4b 徽标实时刷新到《归来与新生之岛》', badge4, `badge=${badge4}`);

  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="play"][data-key="spring_letter"]');
    btn?.click();
  });
  const cur5 = await waitMusic('spring_letter');
  result('T5 切换《春深有信》→ 播放', cur5 === 'spring_letter', cur5);
  const badge5 = await waitBadge('spring_letter');
  result('T5b 徽标实时刷新到《春深有信》', badge5, `badge=${badge5}`);

  await page.evaluate(() => document.querySelector('#music-box-panel [data-action="close"]')?.click());
  const vis6 = await waitPanel(false);
  const cur6 = await page.evaluate(() => window.debug.musicCurrent?.() ?? null);
  result('T6 关闭面板音乐继续', vis6 === false && cur6 === 'spring_letter', `visible=${vis6} music=${cur6}`);

  await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    if (s.musicBoxMark) { s.player.x = s.musicBoxMark.x + 4; s.player.y = s.musicBoxMark.y + 16; }
    s.player.facing = 'up';
    s.tryMusicBoxInteract();
  });
  const vis7 = await waitPanel(true);
  await page.evaluate(() => document.querySelector('#music-box-panel [data-action="stop"]')?.click());
  const cur7 = await waitMusic('farm_day');
  result('T7 「停止播放」恢复老屋日常 BGM', vis7 && cur7 === 'farm_day', `visible=${vis7} music=${cur7}`);

  // ── v0.11（P0.5 音乐优先级）：我的歌 > 地图默认 ──
  // T8 选曲（设为"我的歌"）→ 切到青禾镇 → 音乐保持我的歌（不切回 town 默认）
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    if (s.musicBoxMark) { s.player.x = s.musicBoxMark.x + 4; s.player.y = s.musicBoxMark.y + 16; }
    s.player.facing = 'up';
    s.tryMusicBoxInteract();
  });
  const vis8 = await waitPanel(true);
  await page.evaluate(() => {
    const btn = document.querySelector('#music-box-panel [data-action="play"][data-key="spring_letter"]');
    btn?.click();
  });
  await waitMusic('spring_letter');
  await page.evaluate(() => {
    window.debug.setTime(10, 0);
    window.__game.scene.start('town', { spawn: { x: 160, y: 192 } });
  });
  await waitScene('town');
  const cur8 = await waitMusic('spring_letter');
  result('T8 选曲后切到青禾镇仍播「我的歌」', cur8 === 'spring_letter', cur8);

  // T9 回到老屋「停止播放」（清我的歌）→ 切到青禾镇 → 恢复地图默认 town
  await page.evaluate(() => {
    window.__game.scene.start('house', { spawn: { x: 160, y: 192 } });
  });
  await waitScene('house');
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('house');
    if (s.musicBoxMark) { s.player.x = s.musicBoxMark.x + 4; s.player.y = s.musicBoxMark.y + 16; }
    s.player.facing = 'up';
    s.tryMusicBoxInteract();
  });
  const vis9 = await waitPanel(true);
  await page.evaluate(() => document.querySelector('#music-box-panel [data-action="stop"]')?.click());
  const cur9a = await waitMusic('farm_day');
  await page.evaluate(() => {
    window.debug.setTime(10, 0);
    window.__game.scene.start('town', { spawn: { x: 160, y: 192 } });
  });
  await waitScene('town');
  const cur9b = await waitMusic('town');
  result('T9 停止播放后切到青禾镇恢复地图默认 BGM', cur9a === 'farm_day' && cur9b === 'town', `house=${cur9a} town=${cur9b}`);

  result('附加 无加载失败/页面错误', warns.length === 0, warns.join('; ').slice(0, 160));
} catch (e) {
  console.log('❌ 探针异常:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\n===== probe-music-box 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);