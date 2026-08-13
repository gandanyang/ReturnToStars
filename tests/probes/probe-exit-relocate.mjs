/**
 * probe-exit-relocate.mjs — 出口重定位验证（2026-08-13 制作人反馈）
 *
 * 背景：town 地图 50×35 扩容后，两个出口触发区位置不合理：
 *   1) town→farm：col10-11 → col6-7, row19-20（"左边一点边缘位置"，河岸内侧，
 *      避开 r17-18 横贯荒地带防路过误吸；S6 长椅 (5,15) 停留点不受影响）
 *   2) town→elder_house：(28,20) 建筑西侧偏上（紧邻中央广场 NPC 区，玩家路过被吸走）
 *      → 镇长家门 (33,25) 正下方 row26-27（玩家须主动走到门口才触发）
 *   3) town→mine 矿洞入口：(24,8) 顶部偏中 → 地图最顶端 (24,0)（2026-08-13 制作人拍板），
 *      mine→town 出生点随之下移 3 格至 (25,4)（y=64 > 触发区下边界 32，防一帧弹回）
 *
 * 验证：
 *   段A town→farm 新触发区 (112,320) 触发切图
 *   段B town→elder_house 新触发区 (528,432) 触发切图
 *   段C 旧位置不再触发（(464,336) 旧镇长家区 / (176,280) 旧农场区 / 中央广场 (400,320)）
 *   段D elder_house 门口回 town 出生点 (448,304) 远离新触发区，不会立刻弹回
 *   段E farm→town 出生点 (208,288) 远离新触发区（走荒地带不误吸）
 *   段F town 顶部新矿洞入口 (400,16) 触发切图 → mine
 *   段G mine→town 出生点 (400,64) 不立刻弹回（仍在 town）
 *   段H 旧矿洞入口 (400,144) 不再触发
 *
 * 前置：dev server（建议独立端口 5199）
 * 运行：GAME_URL=http://localhost:5199/ node tests/probes/probe-exit-relocate.mjs
 */
import puppeteer from 'puppeteer-core';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false,
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
const pageErrs = [];
page.on('pageerror', e => pageErrs.push(e.message));

const baseSave = (patch = {}) => ({
  version: '0.5', savedAt: 'exit-relocate', timestamp: Date.now(),
  player: { x: 360, y: 440, scene: 'town', facing: 'up', inventory: {} },
  world: { day: 1, hour: 12, minute: 0, coins: 500, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' }, chapter: 0,
  worldRestore: patch.worldRestore ?? {},
  gameState: { triggeredEvents: patch.triggeredEvents ?? {} },
});

async function enterTown() {
  await page.evaluate(() => localStorage.removeItem('return_star_save'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1600);
  await page.evaluate(s => localStorage.setItem('return_star_save', JSON.stringify(s)), baseSave());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(() => { if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k))); });
  await sleep(2200);
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
    if (sc === 'town') break;
  }
  await sleep(1200);
  // 关闭可能自动播放的开场对话（否则 update 提前 return，出口检测暂停）
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('town');
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset();
  });
  await sleep(400);
}

/** 当前活动场景 key */
const sceneKey = () => page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
/**
 * 瞬移（setPosition 同步 body）→ 轮询等待场景切换完成（而非固定 sleep——沙箱/慢机器
 * 上固定等待会导致切图过渡中 getScenes(true)[0] 为 undefined 而崩溃）→ 返回场景 key。
 * 先 reset 对话：storyDialogue 打开时 update 提前 return，出口检测暂停（对话中玩家本不可移动）。
 */
async function teleportAndWait(x, y, wait = 2000, timeout = 15000) {
  const keyBefore = await sceneKey();
  await page.evaluate(([px, py]) => {
    const s = window.__game?.scene?.getScenes(true)?.[0];
    if (s?.storyDialogue?.isOpen?.()) s.storyDialogue.reset();
    if (s?.player) s.player.setPosition(px, py);
  }, [x, y]);
  // 轮询：活动场景 key 变化 = 切图完成；无切换则等满 wait 后再稳定 200ms
  const t0 = Date.now();
  let cur = await sceneKey();
  while (Date.now() - t0 < timeout) {
    await sleep(300);
    cur = await sceneKey();
    if (cur !== 'none' && cur !== keyBefore) break;
    if (cur !== 'none' && Date.now() - t0 >= wait) break;
  }
  await sleep(200);
  return cur;
}
/** 瞬移到指定场景的触发区中心（等待进入该场景） */
async function gotoScene(scene, x, y, wait = 2000) {
  const sc = await teleportAndWait(x, y, wait);
  return sc === scene;
}

try {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(800);
  await enterTown();

  // ========== 段A：town→farm 新触发区 ==========
  console.log('--- 段A town→farm 新触发区 (112,320) ---');
  let sc = await teleportAndWait(112, 320);
  check('A: 新触发区触发 → farm', sc === 'farm', `场景=${sc}`);

  // 回 town（farm→town 出口中心 (616,168)）
  sc = await teleportAndWait(616, 168);
  check('A: farm→town 返回正常', sc === 'town', `场景=${sc}`);
  // 回 town 后出生点 (208,288) 不应立刻触发反向出口
  const spawnAfterBack = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null;
  });
  await sleep(1000);
  sc = await sceneKey();
  check('A: farm→town 出生点不立刻弹回（仍在 town）', sc === 'town' && spawnAfterBack !== null, `场景=${sc} spawn=${JSON.stringify(spawnAfterBack)}`);

  // ========== 段B：town→elder_house 新触发区 ==========
  console.log('--- 段B town→elder_house 门口触发区 (528,432) ---');
  sc = await teleportAndWait(528, 432);
  check('B: 门口触发区触发 → elder_house', sc === 'elder_house', `场景=${sc}`);

  // 从镇长家出门回 town（elder_house 门出口中心 (96,152)）
  sc = await teleportAndWait(96, 152);
  check('B: elder_house→town 返回正常', sc === 'town', `场景=${sc}`);
  const spawnAtHome = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null;
  });
  await sleep(1000);
  sc = await sceneKey();
  check('B: 回 town 出生 (448,304) 不立刻弹回镇长家', sc === 'town', `场景=${sc} spawn=${JSON.stringify(spawnAtHome)}`);

  // ========== 段C：旧位置不再触发（误吸修复） ==========
  console.log('--- 段C 旧触发区位置不再误吸 ---');
  // 旧 elder_house 区 (28,20)-(30,22) 中心 ≈ (464,336)
  sc = await teleportAndWait(464, 336, 1200);
  check('C: 旧镇长家位置 (464,336) 不再触发', sc === 'town', `场景=${sc}`);
  // 中央广场南缘（miner/adventurer 站位附近，曾是误吸高发区）
  sc = await teleportAndWait(400, 328, 1200);
  check('C: 中央广场南缘 (400,328) 不触发', sc === 'town', `场景=${sc}`);
  // 旧 farm 区 (10,17)-(12,19) 中心 ≈ (176,288)
  sc = await teleportAndWait(176, 288, 1200);
  check('C: 旧农场位置 (176,288) 不再触发', sc === 'town', `场景=${sc}`);
  // 新 farm 区附近横路 r17-18（玩家走荒地带西行）不误吸
  sc = await teleportAndWait(120, 280, 1200);
  check('C: 横路西行 (120,280) 不误吸（触发区在 y≥304）', sc === 'town', `场景=${sc}`);
  // S6 长椅停留点 (88,248) 不触发
  sc = await teleportAndWait(88, 248, 1200);
  check('C: S6 长椅停留点 (88,248) 不触发', sc === 'town', `场景=${sc}`);

  // ========== 段D：新触发区边界外不触发 ==========
  console.log('--- 段D 新触发区边界检查 ---');
  // elder_house 触发区 (512-560, 416-448)：紧邻左侧 (504,432) 不触发
  sc = await teleportAndWait(504, 432, 1200);
  check('D: 门口触发区左侧 8px 外 (504,432) 不触发', sc === 'town', `场景=${sc}`);
  // farm 触发区 (96-128, 304-336)：上方 (112,296) 不触发
  sc = await teleportAndWait(112, 296, 1200);
  check('D: farm 触发区上方 8px 外 (112,296) 不触发', sc === 'town', `场景=${sc}`);

  // ========== 段E：最终正触发 ==========
  console.log('--- 段E 正触发复验 ---');
  sc = await teleportAndWait(528, 432);
  check('E: 门口触发区最终确认 → elder_house', sc === 'elder_house', `场景=${sc}`);
  await teleportAndWait(96, 152); // 回 town
  sc = await teleportAndWait(112, 320);
  check('E: farm 触发区最终确认 → farm', sc === 'farm', `场景=${sc}`);

  // ========== 段F：town 顶部新矿洞入口 (24T,0) ==========
  console.log('--- 段F town 顶部矿洞入口 (400,16) ---');
  // 回到 town（farm→town 出口中心 (616,168)）
  await teleportAndWait(616, 168);
  sc = await teleportAndWait(400, 16);
  check('F: 顶部新矿洞入口触发 → mine', sc === 'mine', `场景=${sc}`);

  // ========== 段G：mine→town 出生点 (400,64) 不弹回 ==========
  console.log('--- 段G mine→town 出生点 ---');
  // mine 底→小镇出口中心 (240,304)
  sc = await teleportAndWait(240, 304);
  check('G: mine→town 返回正常', sc === 'town', `场景=${sc}`);
  const spawnAtMine = await page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    return s?.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null;
  });
  await sleep(1000);
  sc = await sceneKey();
  check('G: 出生 (400,64) 不立刻弹回矿洞（仍在 town）', sc === 'town',
    `场景=${sc} spawn=${JSON.stringify(spawnAtMine)}`);

  // ========== 段H：旧矿洞入口 (400,144) 不再触发 ==========
  console.log('--- 段H 旧矿洞入口位置不误吸 ---');
  sc = await teleportAndWait(400, 144, 1200);
  check('H: 旧矿洞入口 (400,144) 不再触发', sc === 'town', `场景=${sc}`);

  if (pageErrs.length) console.log(`页面错误（${pageErrs.length}）:`, pageErrs.slice(0, 5));
  check('无页面运行时错误', pageErrs.length === 0, pageErrs.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

console.log(`\n===== probe-exit-relocate 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
