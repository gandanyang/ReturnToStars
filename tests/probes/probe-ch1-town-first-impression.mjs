/**
 * probe-ch1-town-first-impression.mjs — 第一章 Town 首见 5 秒验证探针
 *
 * 验证制作人验收标准（2026-08-13 拍板）：
 *   玩家第一次进入新 town 时，5 秒内能不能理解：
 *   "这里曾经有人生活，但现在正在慢慢回来。"
 *
 * 方法：
 *   1. 种子存档：玩家位于 farm→town 出生点 (13T,18T)=(208,296)，面向北（老街方向）
 *   2. 截取出生后第一帧（5 秒内视角）
 *   3. 分析视野内是否同时存在两类信号：
 *      - "曾有人生活"：老街破损屋 / 宅基地残垣 / 民居 / 水塘
 *      - "正在慢慢回来"：集市广场石板(gid6) / 竖路(gid7) / 修复痕迹
 *   4. 断言：两类信号都可见 → 首见理解成立
 *
 * 依赖：dev server + window.__game（读 map 层瓦片）
 * 视口：横屏 1024x768（项目红线）
 * 运行：node tests/probes/probe-ch1-town-first-impression.mjs
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
  if (msg.type() === 'error') warns.push(msg.text());
});

// 种子存档：farm→town 出生点，chapter=1（第一章视角），白天（可见老街）
const save = {
  version: '0.5', savedAt: 'town-first-impression', timestamp: Date.now(),
  player: { x: 208, y: 296, scene: 'town', facing: 'down', inventory: { wood: 0, stone: 0 } },
  world: { day: 1, hour: 10, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'not_started' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' },
  chapter: 1,
  gameState: { triggeredEvents: {} },
};

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(800);
await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(2200);
await page.keyboard.press('Enter');
await sleep(600);
for (let i = 0; i < 25; i++) {
  await sleep(300);
  const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
  if (sc === 'town') break;
}
await sleep(1500); // 模拟"进场后 5 秒内"的稳定视角

// 首见截图
await page.screenshot({ path: 'tests/probes/test-screenshots/ch1-town-first-impression.png' });
console.log('📸 首见截图已存 ch1-town-first-impression.png');

// 视野内信号分析：读取玩家朝向 + 视野方向瓦片信号（北=老街/广场，南=宅基地）
const signals = await page.evaluate(async () => {
  const s = window.__game?.scene?.getScene?.('town');
  if (!s || !s.player) return { err: 'no-scene' };
  const px = s.player.x, py = s.player.y;
  const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
  const countSig = (x0, x1, y0, y1) => {
    const gl = s.groundLayer, wl = s.wallsLayer;
    let road = 0, plaza = 0, roof = 0, wall = 0, water = 0, tree = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const gv = gl?.getTileAt(x, y)?.index ?? 0;
        const wv = wl?.getTileAt(x, y)?.index ?? 0;
        if (gv === 7) road++;
        if (gv === 6) plaza++;
        if (wv === 9 || wv === 10 || wv === 11) wall++;
        if (wv === 9) roof++;
        if (wv === 4) water++;
        if (wv === 16) tree++;
      }
    }
    return { road, plaza, roof, wall, water, tree };
  };
  const north = countSig(10, 39, 0, 7);
  const here = countSig(tx - 5, tx + 5, ty - 5, ty + 5);
  // 宅基地可能超出相机视野（瓦片惰性渲染）→ 直接从地图 JSON 验证
  let southData = null;
  try {
    const res = await fetch('assets/maps/town.json');
    const map = await res.json();
    const W = map.width;
    const wl = map.layers[1].data;
    let wallCount = 0;
    for (let y = 29; y <= 33; y++) {
      for (let x = 22; x <= 27; x++) {
        const v = wl[y * W + x];
        if (v === 10) wallCount++;
      }
    }
    southData = { wall: wallCount };
  } catch (e) {
    southData = { err: e.message };
  }
  return { tx, ty, north, here, south: southData };
});
console.log('信号分析:', JSON.stringify(signals));

const northOk = signals.north && signals.north.roof >= 6 && signals.north.wall >= 6;
const roadOk = signals.north && signals.north.road >= 2 && signals.north.plaza >= 10;
const southOk = signals.south && signals.south.wall >= 3;
result('北向视野含"曾有人生活"（老街破损屋+民居屋顶墙）', northOk, JSON.stringify(signals.north));
result('北向视野含"正在慢慢回来"（集市广场石板+竖路）', roadOk, JSON.stringify(signals.north));
result('南向存在宅基地残垣（未来叙事空间）', southOk, JSON.stringify(signals.south));
result('玩家出生点周围有道路（非孤立草地）', (signals.here?.road ?? 0) >= 2, JSON.stringify(signals.here));
result('附加 无页面错误', warns.length === 0, warns.join('; ').slice(0, 160));

await browser.close();
console.log(`\n===== probe-ch1-town-first-impression 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
