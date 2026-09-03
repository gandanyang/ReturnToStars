/**
 * probe-ch3-lighthouse-seed-e2e.mjs — 幕一「灯塔开门」种子档全链验收（2026-09-03 修复回归）
 *
 * 背景（制作人实测 bug：选新种子后灯塔没开门）：
 *   R1 ch2 种子漏 lighthouse_lit_seen → farm 重播「去灯塔的路，还堵着」旧台词（与解锁后状态矛盾）
 *   R2 黑点触发时缺口视觉不即时出现（create 时未解锁被跳过，须重进场景）
 *   R3 实机 APK farm.json 缺口未打通（打包侧，代码修复后需重新打包——本探针只验 web）
 *
 * 断言：
 *   A1 真实 DevTestHub 流程选「夜谈之后」(ch2_perm) → 进 farm，3 秒内无「路还堵着」台词
 *   A2 ch2_black_dot 自动触发（21:00 + 出生点 x=100≤140 西侧）
 *   A3 缺口视觉即时重建（farmWestGapBuilt === true，无需重进场景）
 *   A4 传送到西侧出口触发区 (50,184) → 场景切换 lighthouse（灯塔开门）
 *   B1 ch2_pier_ready 种子进 qinghe_river → 钓点 pos=(88,232) floatPos=(72,216)
 *   B2 浮漂落点在水面（walls tile(4,13)=水 gid4）、站位可走（tile(5,14)=0）
 *   B3 钓点距老船长 (74,330) 约 100px（同屏"旁边"）
 *   Z  无页面错误
 *
 * 运行：node tests/probes/probe-ch3-lighthouse-seed-e2e.mjs（需 dev server :5173）
 */
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: 'new',
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
let pass = 0, fail = 0;
function result(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}
const warns = [];
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') warns.push('console: ' + m.text()); });

async function waitScene(key, timeout = 25000) {
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

async function activeMapScene() {
  return page.evaluate(() => {
    const maps = (window.__game?.scene?.getScenes(true) ?? []).filter((s) => s.player);
    return maps.length ? maps[maps.length - 1].scene.key : 'none';
  });
}

/** 真实 DevTestHub 流程：station 公告栏 → 种子菜单 → 点击指定种子 */
async function selectSeed(label) {
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('station');
    s.player.x = 400; s.player.y = 430;
  });
  await sleep(300);
  await page.keyboard.press('KeyE');
  await sleep(800);
  const clicked = await page.evaluate((lb) => {
    const items = [...document.querySelectorAll('div')];
    const target = items.find((el) => el.textContent.includes(lb) && el.style.cursor === 'pointer');
    if (target) { target.click(); return true; }
    return false;
  }, label);
  if (!clicked) throw new Error('未找到种子选项: ' + label);
}

try {
  // ============ Part A：灯塔开门全链（ch2_perm） ============
  await page.goto(BASE + '?reset=1', { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.goto(BASE + '?devHub=1', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.waitForFunction(() => !!window.__game?.scene?.getScene?.('title')?.scene.isActive(), { timeout: 10000 });
  await sleep(500);
  await page.keyboard.press('Enter');
  await waitScene('station', 15000);
  await sleep(1000);

  await selectSeed('夜谈之后');
  const farmLoaded = await waitScene('farm', 20000);
  result('A0 选「夜谈之后」→ 进 farm', farmLoaded);
  await sleep(3000); // 等 update 跑数帧（黑点判定 + 台词窗口）

  const a1 = await page.evaluate(() => {
    const t = document.body.innerText;
    return !t.includes('路，还堵着') && !t.includes('再也不会亮');
  });
  result('A1 无「去灯塔的路还堵着」旧台词重播', a1);

  const a23 = await page.evaluate(() => {
    const maps = (window.__game?.scene?.getScenes(true) ?? []).filter((s) => s.player);
    const s = maps[maps.length - 1];
    return {
      blackDot: window.debug?.events?.hasTriggered?.('ch2_black_dot'),
      gapBuilt: s?.farmWestGapBuilt,
      litSeen: window.debug?.events?.hasTriggered?.('lighthouse_lit_seen'),
      litRestored: window.debug?.restores?.isRestored?.('lighthouseLit') ?? null,
    };
  });
  result('A2 ch2_black_dot 已触发（黑点钩子）', a23.blackDot === true, `got ${a23.blackDot}`);
  result('A2b lighthouse_lit_seen 种子已标记（不再重播首映台词）', a23.litSeen === true, `got ${a23.litSeen}`);
  result('A3 缺口视觉即时重建 farmWestGapBuilt=true', a23.gapBuilt === true, `got ${a23.gapBuilt}`);

  // 传送到西侧出口触发区中心
  await page.evaluate(() => {
    const maps = (window.__game?.scene?.getScenes(true) ?? []).filter((s) => s.player);
    const s = maps[maps.length - 1];
    s.player.x = 50; s.player.y = 184;
  });
  await sleep(4000);
  const a4 = await activeMapScene();
  result('A4 西侧出口放行 → 进灯塔', a4 === 'lighthouse', `scene=${a4}`);

  // ============ Part B：钓点岸边化（ch2_pier_ready → qinghe_river） ============
  await page.evaluate(() => { window.__game.scene.start('station'); });
  await sleep(2000);
  await waitScene('station', 15000);
  await sleep(800);
  await selectSeed('老船长靠岸');
  const qingheLoaded = await waitScene('qinghe_river', 20000);
  result('B0 选「老船长靠岸」→ 进 qinghe_river', qingheLoaded);
  await sleep(2000);

  if (qingheLoaded) {
    const b = await page.evaluate(() => {
      const maps = (window.__game?.scene?.getScenes(true) ?? []).filter((s) => s.player);
      const s = maps[maps.length - 1];
      const fx = Math.round(s.fishingSpotPos.x), fy = Math.round(s.fishingSpotPos.y);
      const flx = Math.round(s.floatPos.x), fly = Math.round(s.floatPos.y);
      const floatTile = s.wallsLayer?.getTileAt(Math.floor(flx / 16), Math.floor(fly / 16));
      const posTile = s.wallsLayer?.getTileAt(Math.floor(fx / 16), Math.floor(fy / 16));
      const dx = fx - 74, dy = fy - 330;
      return {
        pos: { x: fx, y: fy }, float: { x: flx, y: fly },
        floatTileIdx: floatTile?.index ?? null,
        posTileIdx: posTile?.index ?? null,
        distToCaptain: Math.round(Math.sqrt(dx * dx + dy * dy)),
      };
    });
    result('B1 钓点 pos=(88,232) float=(72,216)',
      b.pos.x === 88 && b.pos.y === 232 && b.float.x === 72 && b.float.y === 216,
      JSON.stringify({ pos: b.pos, float: b.float }));
    // getTileAt 对空瓦片返回 null（无碰撞=可走）；水面 Walls gid=4
    result('B2 浮漂落水面(tile gid=4) + 站位可走(gid=null/0)',
      b.floatTileIdx === 4 && (b.posTileIdx === null || b.posTileIdx === 0),
      `floatTile=${b.floatTileIdx} posTile=${b.posTileIdx}`);
    result('B3 距老船长约 100px（同屏）', b.distToCaptain > 80 && b.distToCaptain < 130,
      `dist=${b.distToCaptain}`);
  }
} finally {
  const z = warns.length === 0;
  result('Z 无页面错误', z, warns.slice(0, 5).join(' | '));
  console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}
