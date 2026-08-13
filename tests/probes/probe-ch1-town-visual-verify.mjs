/**
 * probe-ch1-town-visual-verify.mjs — 第一章 town 视觉验证（制作人"地图整个做好"验收）
 *
 * 验证第0章残留清理 + 完整地图排布视觉效果：
 *   - chapter=1 任务面板应隐藏（残留清理）
 *   - 镇长家提示应消失（残留清理）
 *   - 地图视觉密度（每个区域都有内容：老街/镇中心/集市/田/河/南）
 *   - 截图供制作人目测
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'test-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH, headless: false, // 规则3：动画游戏必须真实渲染
  defaultViewport: { width: 1024, height: 768 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  ← ' + detail}`);
  ok ? pass++ : fail++;
}

const save = {
  version: '0.5', savedAt: 'ch1-visual', timestamp: Date.now(),
  player: { x: 208, y: 296, scene: 'town', facing: 'up', inventory: {} },
  world: { day: 1, hour: 12, minute: 0, coins: 100, level: 1, xp: 0, stamina: 100, minedOres: [], questState: 'completed' },
  farm: { tiles: [], crops: [], trees: [] },
  story: { storyStep: 'done' }, chapter: 1,
  gameState: { triggeredEvents: { first_morning_response: true, grandpa_gift_opened: true } },
};

await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
await sleep(800);
// 强制绕过缓存获取最新 town.json
const freshMap = await page.evaluate(async () => {
  const r = await fetch('assets/maps/town.json?t=' + Date.now());
  return await r.json();
});
save.freshMap = freshMap; // 仅供调试
await page.evaluate((s) => localStorage.setItem('return_star_save', JSON.stringify(s)), save);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await page.evaluate(() => {
  // 再次强制刷新地图资源（绕过 service worker / HMR 缓存）
  if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
});
await sleep(2200);
await page.keyboard.press('Enter');
await sleep(600);
for (let i = 0; i < 25; i++) {
  await sleep(300);
  const sc = await page.evaluate(() => window.__game?.scene?.getScenes(true)[0]?.scene?.key ?? 'none');
  if (sc === 'town') break;
}
await sleep(1500);

// 验证残留清理
const cleanup = await page.evaluate(() => {
  const s = window.__game.scene.getScene('town');
  return {
    questHud: s?.hudQuestDom?.style.display !== 'none',
    elderHint: s?.elderHouseHint ? (s.elderHouseHint.sprite?.visible ? 'visible' : 'hidden') : 'none',
  };
});
check('chapter=1 隐藏任务卡', !cleanup.questHud, `display=${cleanup.questHud}`);
check('chapter=1 镇长家提示消失', cleanup.elderHint === 'none' || cleanup.elderHint === 'hidden', `状态=${cleanup.elderHint}`);

// 验证地图视觉密度（瓦片数）
const density = await page.evaluate(async () => {
  const res = await fetch('assets/maps/town.json');
  const m = await res.json();
  const W = m.width;
  const g = m.layers[0].data, w = m.layers[1].data;
  const N = g.length;
  const nonEmptyG = g.filter(v => v !== 0).length;
  const nonEmptyW = w.filter(v => v !== 0).length;
  // 各区域瓦片数
  const count = (x0, x1, y0, y1, layer) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (layer[y * W + x] !== 0) n++;
    return n;
  };
  return {
    nonEmptyG, nonEmptyW,
    coverage: ((nonEmptyG + nonEmptyW) / (N * 2) * 100).toFixed(1) + '%',
    regions: {
      老街: count(10, 39, 0, 7, w) + count(10, 39, 0, 7, g),
      镇中心: count(10, 39, 8, 27, w) + count(10, 39, 8, 27, g),
      老屋区: count(10, 39, 28, 34, w) + count(10, 39, 28, 34, g),
      河边: count(0, 9, 0, 34, w) + count(0, 9, 0, 34, g),
      东区田: count(40, 49, 0, 34, w) + count(40, 49, 0, 34, g),
    },
  };
});
console.log('地图密度:', JSON.stringify(density, null, 2));
check('地图整体填充率 > 50%', parseFloat(density.coverage) > 50, density.coverage);
check('老街/镇中心/老屋/河边/东田 都有内容',
  Object.values(density.regions).every(v => v > 0),
  JSON.stringify(density.regions));

// 截图：4 个视角
const shots = [
  { pos: [208, 296], face: 'up', label: '01-first-north' },     // 出生点看北
  { pos: [408, 130], face: 'down', label: '02-plaza' },           // 站在广场
  { pos: [720, 200], face: 'left', label: '03-east-field' },      // 看东区田
  { pos: [120, 400], face: 'right', label: '04-river-west' },     // 看西河边
];
for (const s of shots) {
  await page.evaluate(([x, y, f]) => {
    const sc = window.__game.scene.getScene('town');
    if (sc?.player) { sc.player.setPosition(x, y); sc.player.facing = f; }
  }, [s.pos[0], s.pos[1], s.face]);
  await sleep(800);
  const p = `tests/probes/test-screenshots/ch1-town-${s.label}.png`;
  await page.screenshot({ path: p });
  console.log(`📸 ${s.label} (${s.pos}, ${s.face})`);
}

await browser.close();
console.log(`\n===== probe-ch1-town-visual-verify 结果: ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
